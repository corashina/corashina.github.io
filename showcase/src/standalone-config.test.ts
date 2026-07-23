import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

const read = (path: string): string => readFileSync(path, "utf8");

describe("standalone project boundary", () => {
  it("uses portable root paths and no portfolio deployment hook", () => {
    const vite = read("vite.config.ts");
    const playwright = read("playwright.config.ts");
    const e2e = read("e2e/showcase.e2e.ts");
    const capture = read("scripts/capture-fallback.mjs");
    const readme = read("README.md");
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(vite).toContain('base: "./"');
    expect(document.querySelector(".showcase-fallback img")?.getAttribute("src")).toBe("./fallback.png");
    expect(document.querySelector('script[type="module"]')?.getAttribute("src")).toBe("./src/main.ts");
    expect(packageJson.scripts["build:portfolio"]).toBeUndefined();
    expect(playwright).toContain('url: "http://127.0.0.1:4174/"');
    expect(playwright).toContain('"node node_modules/vite/bin/vite.js preview');

    for (const source of [vite, playwright, e2e, capture, readme, html]) {
      expect(source).not.toContain("/showcase/");
    }
  });

  it("ignores standalone generated output", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");
    expect(gitignore).toContain("test-results/");
    expect(gitignore).toContain("playwright-report/");
  });
});
