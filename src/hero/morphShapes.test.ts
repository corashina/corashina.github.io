import { describe, expect, it } from "vitest";
import {
  MORPH_ORDER,
  MORPH_SEGMENT_SECONDS,
  MORPH_TRANSITION_SECONDS,
  SHAPES,
  easeInOutCubic,
  morphStateAt,
} from "./morphShapes";

describe("morph shapes", () => {
  it("keeps every point of every shape finite and near the unit sphere", () => {
    for (const name of MORPH_ORDER) {
      for (let index = 0; index < 2_400; index += 1) {
        const point = SHAPES[name](index, 2_400);
        expect(point.every(Number.isFinite)).toBe(true);
        expect(Math.hypot(...point)).toBeLessThanOrEqual(1.25);
      }
    }
  });

  it("eases from 0 to 1 symmetrically", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("walks through the shapes in order and wraps around", () => {
    expect(morphStateAt(0)).toEqual({ from: "sphere", to: "torus", progress: 0 });
    expect(morphStateAt(MORPH_TRANSITION_SECONDS + 1)).toMatchObject({ from: "sphere", to: "torus", progress: 1 });
    expect(morphStateAt(MORPH_SEGMENT_SECONDS * 4 + 0.01)).toMatchObject({ from: "helix", to: "sphere" });
    expect(morphStateAt(-3)).toEqual({ from: "sphere", to: "torus", progress: 0 });
  });
});
