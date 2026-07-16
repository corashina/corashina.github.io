/// <reference types="node" />

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projects } from "./projects";

describe("private artwork", () => {
  it("provides titled 320 by 160 SVGs", async () => {
    for (const project of projects.filter((item) => !item.sourceUrl)) {
      const file = await readFile(
        new URL("../../static" + project.media.src, import.meta.url),
        "utf8",
      );
      expect(file).toContain("<title>");
      expect(file).toContain('viewBox="0 0 320 160"');
      expect(file).not.toMatch(
        /(?:data-(?:employer|client|company|organi[sz]ation)|<(?:text|title|desc)[^>]*>[^<]*(?:employer|client|company|organi[sz]ation)\s*(?:name\s*)?[:=-])/i,
      );
    }
  });
});
