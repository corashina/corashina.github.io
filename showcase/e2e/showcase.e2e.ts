import { expect, test, type Page } from "@playwright/test";

const browserErrors = new WeakMap<Page, string[]>();
const telemetryAttributes = [
  "data-showcase-ready", "data-last-pulse", "data-last-reset", "data-reduced-motion",
  "data-showcase-layers", "data-rendered-frames", "data-last-orbit", "data-last-zoom",
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
