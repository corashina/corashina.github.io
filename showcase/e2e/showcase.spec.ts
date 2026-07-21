import { expect, test, type Page } from "@playwright/test";

async function expectReady(page: Page): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("data-showcase-ready", "true");
  await expect(page.locator("#showcase-canvas")).toBeVisible();
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

test("loads the WebGL showcase at its production base path", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  expect(errors).toEqual([]);
});

test("accepts direct interaction", async ({ page }) => {
  await page.goto("/showcase/?quality=low&test=1");
  const canvas = page.locator("#showcase-canvas");
  await canvas.hover({ position: { x: 300, y: 220 } });
  await canvas.click({ position: { x: 300, y: 220 } });
  await expect(page.locator("html")).toHaveAttribute("data-last-pulse", "1");
});

test("applies manual Low quality", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await page.getByLabel("Rendering quality").selectOption("low");
  await expect(page.locator("html")).toHaveAttribute("data-quality-tier", "low");
});

test("keeps the scene ready after a keyboard reset", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await page.keyboard.press("r");
  await expect(page.locator("html")).toHaveAttribute("data-last-reset", "1");
  await expectReady(page);
});

test("supports reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-quality-tier", "medium");
});

test("supports a touch viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await page.locator("#showcase-canvas").dispatchEvent("touchstart");
  await page.locator("#showcase-canvas").dispatchEvent("touchend");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "ready");
});

test("restores after a first WebGL context loss", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  expect(await loseWebGlContext(page)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "recovering");
  expect(await loseWebGlContext(page, true)).toBe(true);
  await expectReady(page);
});

test("shows the fallback after a second WebGL context loss", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  expect(await loseWebGlContext(page)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "recovering");
  expect(await loseWebGlContext(page, true)).toBe(true);
  await expectReady(page);
  expect(await loseWebGlContext(page)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-showcase-state", "fallback");
  await expect(page.locator(".showcase-fallback")).toBeVisible();
});

test("serves direct /showcase/ navigation from a production build", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
});
