import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "public", "fallback.png");
const port = 4175;

function run(command, args) {
  const child = spawn(command, args, { cwd: root, stdio: "inherit", windowsHide: true });
  return once(child, "exit").then(([code]) => {
    if (code !== 0) throw new Error(`${command} exited with code ${code ?? "unknown"}.`);
  });
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/showcase/`);
      if (response.ok) return;
    } catch { /* preview is still starting */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
  }
  throw new Error("Timed out waiting for the production preview.");
}

async function capture(page, viewport, destination) {
  await page.setViewportSize(viewport);
  await page.goto(`http://127.0.0.1:${port}/showcase/?capture=1&test=1`, { waitUntil: "networkidle" });
  await page.locator("html").waitFor({ state: "attached" });
  await page.locator("html[data-showcase-ready='true']").waitFor();
  await page.waitForTimeout(2_000);
  await page.locator(".showcase-controls").evaluate((controls) => { controls.style.display = "none"; });
  await page.screenshot({ path: destination, type: "png", timeout: 120_000 });
}

await run(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"]);
await run(process.execPath, ["node_modules/vite/bin/vite.js", "build"]);
await mkdir(dirname(output), { recursive: true });
const candidate = `${output}.capture.png`;
const preview = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--host", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
});

try {
  await waitForPreview();
  const browser = await chromium.launch({ args: ["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await capture(page, { width: 1600, height: 1000 }, candidate);
    if ((await stat(candidate)).size > 1_500_000) await capture(page, { width: 1440, height: 900 }, candidate);
  } finally {
    await browser.close();
  }
  const size = (await stat(candidate)).size;
  if (size < 20_000) throw new Error(`The WebGL capture was blank (${size} bytes); the existing fallback was preserved.`);
  if (size > 1_500_000) throw new Error(`fallback.png is ${size} bytes; recapture did not meet the 1.5 MB limit.`);
  await rename(candidate, output);
  console.log(`Captured ${output} (${size} bytes).`);
} finally {
  preview.kill();
  await rm(candidate, { force: true });
}
