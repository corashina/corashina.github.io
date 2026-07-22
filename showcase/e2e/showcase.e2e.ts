import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
const telemetryAttributes = [
  "data-showcase-ready", "data-last-pulse", "data-last-reset", "data-reduced-motion",
  "data-showcase-layers", "data-rendered-frames", "data-last-orbit", "data-last-zoom", "data-scene-speed",
] as const;

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
});

test.afterEach(({ page }) => expect(browserErrors.get(page) ?? []).toEqual([]));

async function expectReady(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-showcase-ready", "true");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-layers", "1");
  await expect(page.locator("#showcase-canvas")).toBeVisible();
}

async function expectVisibleParticles(page: Page): Promise<void> {
  const snapshot = await page.locator("#showcase-canvas").screenshot({
    style: ".showcase-controls, .showcase-status { visibility: hidden !important; }",
  });
  const distribution = await page.evaluate(async (dataUrl) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not decode the rendered canvas snapshot"));
      element.src = dataUrl;
    });
    const copy = document.createElement("canvas");
    copy.width = image.naturalWidth;
    copy.height = image.naturalHeight;
    const context = copy.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("2D canvas context unavailable");
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let dark = 0; let luminous = 0; let white = 0; let samples = 0;
    for (let index = 0; index < pixels.length; index += 32) {
      const red = pixels[index]!; const green = pixels[index + 1]!; const blue = pixels[index + 2]!;
      const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue);
      if (maximum < 18) dark += 1;
      if (maximum > 36) luminous += 1;
      if (minimum > 245) white += 1;
      samples += 1;
    }
    return { dark: dark / samples, luminous: luminous / samples, white: white / samples };
  }, `data:image/png;base64,${snapshot.toString("base64")}`);
  expect(distribution.dark).toBeGreaterThan(0.2);
  expect(distribution.luminous).toBeGreaterThan(0.001);
  expect(distribution.white).toBeLessThan(0.1);
}

async function readTelemetry(page: Page): Promise<Record<string, string | null>> {
  return page.locator("html").evaluate((root, names) => Object.fromEntries(names.map((name) => [name, root.getAttribute(name)])), telemetryAttributes);
}

async function loseWebGlContext(page: Page, restore = false): Promise<boolean> {
  return page.evaluate((shouldRestore) => {
    const testWindow = window as typeof window & { webglLossExtension?: WEBGL_lose_context };
    const extension = testWindow.webglLossExtension
      ?? document.querySelector<HTMLCanvasElement>("#showcase-canvas")?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (extension === null || extension === undefined) return false;
    if (!shouldRestore) testWindow.webglLossExtension = extension;
    if (shouldRestore) extension.restoreContext();
    else extension.loseContext();
    return true;
  }, restore);
}

test("loads the WebGL showcase at its testable production base path", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-rendered-frames", /[1-9]\d*/);
  await expect(page.locator("html")).toHaveAttribute("data-scene-speed", "3");
  await expectVisibleParticles(page);
});

test("exposes live particle controls, fps, reset, and collapse", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.locator("[data-fps]")).toHaveText(/\d+ FPS/);
  const speed = page.locator('[data-parameter="speed"]');
  await expect(speed).toHaveValue("3");
  await speed.fill("4.5");
  await expect(page.locator("html")).toHaveAttribute("data-scene-speed", "4.5");
  await page.getByRole("button", { name: "Reset parameters" }).click();
  await expect(speed).toHaveValue("3");
  const toggle = page.getByRole("button", { name: "Toggle Particle Lab" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("serves direct /showcase/ navigation without test instrumentation", async ({ page }) => {
  await page.goto("/showcase/");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "ready");
  await expect(page.locator("#showcase-canvas")).toBeVisible();
  expect(Object.values(await readTelemetry(page))).toEqual(telemetryAttributes.map(() => null));
});

test("accepts direct interaction", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  const canvas = page.locator("#showcase-canvas");
  await canvas.hover({ position: { x: 300, y: 220 } });
  await canvas.click({ position: { x: 300, y: 220 } });
  await expect(page.locator("html")).toHaveAttribute("data-last-pulse", "1");
});

test("keeps the scene ready after a keyboard reset", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await page.keyboard.press("r");
  await expect(page.locator("html")).toHaveAttribute("data-last-reset", "1");
  await expectReady(page);
});

test("supports reduced motion with pulse, keyboard orbit, and zoom controls", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.locator("#showcase-canvas").click({ position: { x: 300, y: 220 } });
  await expect(page.locator("html")).toHaveAttribute("data-last-pulse", "1");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-last-orbit", "true");
  await page.keyboard.press("=");
  await expect(page.locator("html")).toHaveAttribute("data-last-zoom", "true");
});

test("creates a pulse from a touch PointerEvent sequence at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.getByRole("button", { name: "Toggle Particle Lab" })).toHaveAttribute("aria-expanded", "false");
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#showcase-canvas")!;
    const init = { bubbles: true, pointerType: "touch", pointerId: 7, clientX: 160, clientY: 300 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", init));
    canvas.dispatchEvent(new PointerEvent("pointerup", init));
  });
  await expect(page.locator("html")).toHaveAttribute("data-last-pulse", "1");
});

test("restores after a first WebGL context loss", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  expect(await loseWebGlContext(page)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "recovering");
  await expect(page.locator("html")).not.toHaveAttribute("data-showcase-ready");
  expect(await loseWebGlContext(page, true)).toBe(true);
  await expectReady(page);
});

test("shows a loaded static fallback after a second WebGL context loss", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  const canvas = page.locator("#showcase-canvas");
  await canvas.dispatchEvent("webglcontextlost");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "recovering");
  await canvas.dispatchEvent("webglcontextrestored");
  await expectReady(page);
  await canvas.dispatchEvent("webglcontextlost");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "fallback");
  await expect(page.locator("html")).not.toHaveAttribute("data-showcase-ready");
  await expect(page.locator(".showcase-controls")).toBeHidden();
  const fallback = page.locator(".showcase-fallback img");
  await expect(fallback).toBeVisible();
  expect(await fallback.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  expect(Object.values(await readTelemetry(page))).toEqual(telemetryAttributes.map(() => null));
});
