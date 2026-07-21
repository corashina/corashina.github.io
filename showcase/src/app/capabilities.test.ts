import { describe, expect, it, vi } from "vitest";
import { detectCapabilities } from "./capabilities";

describe("detectCapabilities", () => {
  it("reports WebGL 2 and reduced motion", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    const report = detectCapabilities(canvas, () => ({ matches: true }) as MediaQueryList);
    expect(report).toEqual({ webgl2: true, reducedMotion: true });
  });

  it("rejects a canvas without WebGL 2", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    expect(detectCapabilities(canvas, () => ({ matches: false }) as MediaQueryList).webgl2).toBe(false);
  });
});
