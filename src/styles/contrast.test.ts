/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStyles = async () =>
  Promise.all([
    readFile(resolve(process.cwd(), "src/styles/themes.scss"), "utf8"),
    readFile(resolve(process.cwd(), "src/styles/layout.module.scss"), "utf8"),
    readFile(resolve(process.cwd(), "src/styles/global.scss"), "utf8"),
  ]);

const readThemeVariables = (source: string, theme: "white" | "dark") => {
  const block = source.match(new RegExp(`body\\.${theme}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]+);/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
};

describe("original style contracts", () => {
  it("keeps exactly the original five variables inside each theme block", async () => {
    const [themes] = await readStyles();

    expect(readThemeVariables(themes, "white")).toEqual({
      "--color-bg": "#fff",
      "--color-1": "#000",
      "--color-2": "#aaa",
      "--color-25": "#ccc",
      "--color-3": "#880000",
    });
    expect(readThemeVariables(themes, "dark")).toEqual({
      "--color-bg": "#222",
      "--color-1": "#ccc",
      "--color-2": "#666",
      "--color-25": "#444",
      "--color-3": "#f44263",
    });
  });

  it("keeps each directional transform and 500ms easing contract", async () => {
    const [, layout] = await readStyles();

    expect(layout).toMatch(/\.forwardEnter,\s*\.backwardEnter\s*\{\s*opacity: 0;\s*\}/);
    expect(layout).toMatch(/\.forwardEnter\s*\{\s*transform: translateX\(50vw\);\s*\}/);
    expect(layout).toMatch(/\.backwardEnter\s*\{\s*transform: translateX\(-50vw\);\s*\}/);
    expect(layout).toMatch(
      /\.forwardEnterActive,\s*\.backwardEnterActive\s*\{\s*opacity: 1;\s*transform: translateX\(0\);\s*transition: opacity 500ms ease-out, transform 500ms ease-out;\s*\}/,
    );
    expect(layout).toMatch(
      /\.forwardExit,\s*\.backwardExit\s*\{\s*opacity: 1;\s*transform: translateX\(0\);\s*\}/,
    );
    expect(layout).toMatch(
      /\.forwardExitActive,\s*\.backwardExitActive\s*\{\s*opacity: 0;\s*transition: opacity 500ms ease-in, transform 500ms ease-in;\s*\}/,
    );
    expect(layout).toMatch(/\.forwardExitActive\s*\{\s*transform: translateX\(-50vw\);\s*\}/);
    expect(layout).toMatch(/\.backwardExitActive\s*\{\s*transform: translateX\(50vw\);\s*\}/);
  });

  it("disables every directional transform and duration for reduced motion", async () => {
    const [, layout] = await readStyles();
    const reducedMotion =
      layout.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]+)\}\s*$/)?.[1] ??
      "";

    for (const className of [
      "forwardEnter",
      "forwardEnterActive",
      "forwardExit",
      "forwardExitActive",
      "backwardEnter",
      "backwardEnterActive",
      "backwardExit",
      "backwardExitActive",
    ]) {
      expect(reducedMotion).toContain(`.${className}`);
    }
    expect(reducedMotion).toMatch(/transform: none;\s*transition-duration: 0ms;/);
  });

  it("keeps the original shell geometry and video reveal timing", async () => {
    const [, layout, global] = await readStyles();

    expect(layout).toContain("max-width: 600px");
    expect(layout).toContain("max-width: 900px");
    expect(layout).toContain("margin-bottom: 5rem");
    expect(global).toMatch(/video:hover\s*\{[^}]*transition: filter 400ms ease-in-out;/s);
  });
});
