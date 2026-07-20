/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("original style contracts", () => {
  it("keeps the original palettes, shell geometry, and motion timings", async () => {
    const [themes, layout, global] = await Promise.all([
      readFile(resolve(process.cwd(), "src/styles/themes.scss"), "utf8"),
      readFile(resolve(process.cwd(), "src/styles/layout.module.scss"), "utf8"),
      readFile(resolve(process.cwd(), "src/styles/global.scss"), "utf8"),
    ]);

    expect(themes).toContain("--color-bg: #222");
    expect(themes).toContain("--color-1: #ccc");
    expect(themes).toContain("--color-2: #666");
    expect(themes).toContain("--color-25: #444");
    expect(themes).toContain("--color-3: #f44263");
    expect(themes).toContain("--color-bg: #fff");
    expect(layout).toContain("max-width: 600px");
    expect(layout).toContain("max-width: 900px");
    expect(layout).toContain("margin-bottom: 5rem");
    expect(layout).toContain("500ms");
    expect(layout).toContain("50vw");
    expect(global).toContain("400ms");
  });
});
