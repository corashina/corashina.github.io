/// <reference types="node" />

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { projects } from "./projects";

describe("project media", () => {
  it("keeps every media asset beneath static/portfolio", () => {
    for (const { media } of projects) {
      expect(media.src).toMatch(/^\/portfolio\//);
      expect(existsSync(resolve("static", media.src.slice(1)))).toBe(true);
    }
  });
});
