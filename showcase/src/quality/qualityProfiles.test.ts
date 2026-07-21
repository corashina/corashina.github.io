import { describe, expect, it } from "vitest";
import { QUALITY_PROFILES, selectInitialTier } from "./qualityProfiles";

describe("QUALITY_PROFILES", () => {
  it("uses the approved rendering values for every tier", () => {
    expect(QUALITY_PROFILES.ultra).toMatchObject({ particles: 384, membrane: 256, marchingCubes: 56, volumeSteps: 96, pixelRatio: 2, ssrScale: 0.5, gtao: "high", shadows: "pcss-high" });
    expect(QUALITY_PROFILES.high).toMatchObject({ particles: 256, membrane: 192, marchingCubes: 48, volumeSteps: 72, pixelRatio: 1.5, ssrScale: 0.5, gtao: "medium", shadows: "pcss-medium" });
    expect(QUALITY_PROFILES.medium).toMatchObject({ particles: 192, membrane: 128, marchingCubes: 40, volumeSteps: 48, pixelRatio: 1.25, ssrScale: 0.25, gtao: "low", shadows: "pcf" });
    expect(QUALITY_PROFILES.low).toMatchObject({ particles: 128, membrane: 96, marchingCubes: 32, volumeSteps: 28, pixelRatio: 1, ssrScale: 0, gtao: "depth", shadows: "pcf" });
  });
});

describe("selectInitialTier", () => {
  it("chooses high for a capable desktop", () => {
    expect(selectInitialTier({ viewportPixels: 1920 * 1080, devicePixelRatio: 1, hardwareConcurrency: 8, deviceMemory: 8, touch: false, reducedMotion: false })).toBe("high");
  });

  it("chooses medium for touch devices", () => {
    expect(selectInitialTier({ viewportPixels: 1170 * 2532, devicePixelRatio: 3, hardwareConcurrency: 8, deviceMemory: 8, touch: true, reducedMotion: false })).toBe("medium");
  });

  it("caps reduced-motion devices at medium", () => {
    expect(selectInitialTier({ viewportPixels: 1920 * 1080, devicePixelRatio: 1, hardwareConcurrency: 16, deviceMemory: 16, touch: false, reducedMotion: true })).toBe("medium");
  });

  it("chooses low with four or fewer CPU cores", () => {
    expect(selectInitialTier({ viewportPixels: 1920 * 1080, devicePixelRatio: 1, hardwareConcurrency: 4, deviceMemory: 8, touch: false, reducedMotion: false })).toBe("low");
  });

  it("limits high pixel-count displays to medium", () => {
    expect(selectInitialTier({ viewportPixels: 3840 * 2160, devicePixelRatio: 2, hardwareConcurrency: 8, deviceMemory: 8, touch: false, reducedMotion: false })).toBe("medium");
  });
});
