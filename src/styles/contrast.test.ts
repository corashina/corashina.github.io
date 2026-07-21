/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readStyles = async () => {
  const sources = await Promise.all([
    readFile(resolve(process.cwd(), "src/styles/themes.scss"), "utf8"),
    readFile(resolve(process.cwd(), "src/styles/layout.module.scss"), "utf8"),
    readFile(resolve(process.cwd(), "src/styles/global.scss"), "utf8"),
    readFile(resolve(process.cwd(), "src/styles/work.module.scss"), "utf8"),
  ]);
  const [themes, layout, global, work] = sources.map((source) =>
    source.replace(/\r\n/g, "\n"),
  );
  return { global, layout, themes, work };
};

const findBlock = (source: string, header: string): string => {
  let headerIndex = source.indexOf(header);
  let openingBrace = -1;
  while (headerIndex >= 0) {
    openingBrace = source.indexOf("{", headerIndex + header.length);
    if (
      openingBrace >= 0 &&
      /^\s*$/.test(source.slice(headerIndex + header.length, openingBrace))
    ) {
      break;
    }
    headerIndex = source.indexOf(header, headerIndex + header.length);
  }
  if (headerIndex < 0 || openingBrace < 0) return "";
  let depth = 1;
  for (let index = openingBrace + 1; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  return "";
};

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
    const { themes } = await readStyles();

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
    const { layout } = await readStyles();

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

  it("keeps route, page, and media motion enabled regardless of user preference", async () => {
    const { global, layout, work } = await readStyles();

    for (const source of [layout, global, work]) {
      expect(source).not.toContain("@media (prefers-reduced-motion: reduce)");
    }
  });

  it("keeps the exact Questrial import, family, spacing, and breakpoints", async () => {
    const { global, themes } = await readStyles();
    const body = findBlock(global, "body");

    expect(global).toMatch(
      /^@import url\("https:\/\/fonts\.googleapis\.com\/css\?family=Questrial&display=swap"\);$/m,
    );
    expect(body).toMatch(/font-family: "Questrial", sans-serif;/);
    expect(themes).toMatch(/^\$spacing: 1\.5rem;$/m);
    expect(themes).toMatch(/^\$media-sm: 480px;$/m);
    expect(themes).toMatch(/^\$media-md: 768px;$/m);
  });

  it("keeps borders, five-rem separation, and the shared shell width in their selectors", async () => {
    const { layout } = await readStyles();
    const shell = findBlock(layout, ".layout");
    const navigation = findBlock(layout, ".navigation");
    const footer = findBlock(layout, ".footer");

    expect(shell).toMatch(/max-width: 900px;/);
    expect(layout).not.toMatch(/\.workLayout\s*\{/);
    expect(navigation).toMatch(/border-bottom: 1px solid \$color-25;/);
    expect(navigation).toMatch(/margin-bottom: 5rem;/);
    expect(footer).toMatch(/border-top: 1px solid \$color-25;/);
    expect(footer).toMatch(/margin-top: calc\(5rem - #\{\$spacing\}\);/);
  });

  it("keeps Works and detail grids at the exact breakpoints", async () => {
    const { work } = await readStyles();
    const baseGrid = findBlock(work, ".grid");
    const baseDetail = findBlock(work, ".detail");
    const smallViewport = findBlock(work, "@media (min-width: $media-sm)");
    const mediumViewport = findBlock(work, "@media (min-width: $media-md)");

    expect(baseGrid).toMatch(/grid-template-columns: 1fr;/);
    expect(findBlock(smallViewport, ".grid")).toMatch(
      /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/,
    );
    expect(findBlock(mediumViewport, ".grid")).toMatch(
      /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/,
    );
    expect(baseDetail).toMatch(/display: grid;/);
    expect(baseDetail).not.toContain("grid-template-columns");
    expect(findBlock(smallViewport, ".detail")).toMatch(/grid-template-columns: 2fr 1fr;/);
  });

  it("keeps exact card and detail tool geometry inside their selectors", async () => {
    const { work } = await readStyles();
    const card = findBlock(work, ".card");
    const tool = findBlock(work, ".tools li");

    expect(card).toMatch(/border: 1px solid \$color-25;/);
    expect(card).toMatch(/padding: 5px;/);
    expect(tool).toMatch(/border: 1px solid \$color-2;/);
    expect(tool).toMatch(/padding: 0 calc\(#\{\$spacing\} \/ 10\);/);
    expect(tool).toMatch(/margin-right: calc\(#\{\$spacing\} \/ 5\);/);
    expect(tool).toMatch(/margin-bottom: calc\(#\{\$spacing\} \/ 5\);/);
  });

  it("reveals card and detail image or video color over 400ms", async () => {
    const { work } = await readStyles();
    const media = findBlock(work, ".media img,\n.media video");
    const cardReveal = findBlock(
      work,
      ".card:hover .media img,\n.card:hover .media video,\n.card:focus-visible .media img,\n.card:focus-visible .media video",
    );
    const detailReveal = findBlock(
      work,
      ".detail .media:hover img,\n.detail .media:hover video",
    );

    expect(media).toMatch(/filter: grayscale\(1\);/);
    expect(media).toMatch(/transition: filter 400ms ease-in-out;/);
    expect(cardReveal).toMatch(/filter: grayscale\(0\);/);
    expect(detailReveal).toMatch(/filter: grayscale\(0\);/);
  });

});
