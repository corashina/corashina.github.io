/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const relativeLuminance = (hex: string): number => {
  const expanded = hex.length === 4 ? `#${[...hex.slice(1)].map((digit) => digit.repeat(2)).join("")}` : hex;
  const channels = expanded
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (foreground: string, background: string): number => {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
};

const parseTheme = (source: string, theme: "white" | "dark"): Record<string, string> => {
  const block = source.match(new RegExp(`body\\.${theme}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{3,6});/gi)].map((match) => [
      match[1],
      match[2],
    ]),
  );
};

describe("theme text contrast", () => {
  it("keeps legacy decoration colors while semantic text colors meet WCAG AA", async () => {
    const source = await readFile(resolve(process.cwd(), "src/styles/themes.scss"), "utf8");
    const white = parseTheme(source, "white");
    const dark = parseTheme(source, "dark");

    expect(white).toMatchObject({ "color-2": "#aaa", "color-3": "#880000" });
    expect(dark).toMatchObject({ "color-2": "#666", "color-3": "#f44263" });
    expect(white["color-muted-text"]).toBe("#767676");
    expect(dark["color-muted-text"]).toBe("#9a9a9a");
    expect(white["color-accent-text"]).toBe("#880000");
    expect(dark["color-accent-text"]).toBe("#ff5270");

    for (const theme of [white, dark]) {
      expect(contrastRatio(theme["color-muted-text"], theme["color-bg"])).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(contrastRatio(theme["color-accent-text"], theme["color-bg"])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  });
});
