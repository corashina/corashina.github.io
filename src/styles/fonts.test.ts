/// <reference types="node" />

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const globalStyles = readFileSync(resolve("src/styles/global.scss"), "utf8");
const indexHtml = readFileSync(resolve("index.html"), "utf8");

describe("self-hosted fonts", () => {
  it("does not load fonts from a third-party stylesheet", () => {
    expect(globalStyles).not.toMatch(/fonts\.googleapis\.com/);
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com/);
  });

  it("serves every @font-face source from static/fonts", () => {
    const sources = [...globalStyles.matchAll(/url\("(\/fonts\/[^"]+\.woff2)"\)/g)].map(([, path]) => path);
    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(existsSync(resolve("static", source.slice(1)))).toBe(true);
    }
  });

  it("preloads the latin Questrial subset with CORS so the preload is reused", () => {
    expect(indexHtml).toMatch(
      /<link rel="preload" href="\/fonts\/questrial-latin-v19\.woff2" as="font" type="font\/woff2" crossorigin \/>/,
    );
    expect(globalStyles).toContain('url("/fonts/questrial-latin-v19.woff2")');
  });
});
