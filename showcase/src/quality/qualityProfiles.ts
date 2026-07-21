import type { CapabilityReport } from "../app/capabilities";

export type QualityTier = "low" | "medium" | "high" | "ultra";
export type QualityMode = "auto" | QualityTier;
export type GtaoLevel = "depth" | "low" | "medium" | "high";
export type ShadowLevel = "pcf" | "pcss-medium" | "pcss-high";

export type QualityProfile = {
  particles: 128 | 192 | 256 | 384;
  membrane: 96 | 128 | 192 | 256;
  marchingCubes: 32 | 40 | 48 | 56;
  volumeSteps: 28 | 48 | 72 | 96;
  pixelRatio: 1 | 1.25 | 1.5 | 2;
  ssrScale: 0 | 0.25 | 0.5;
  gtao: GtaoLevel;
  shadows: ShadowLevel;
};

export type QualitySelectionInput = Pick<CapabilityReport, "reducedMotion"> & {
  viewportPixels: number;
  devicePixelRatio: number;
  hardwareConcurrency: number;
  deviceMemory?: number;
  touch: boolean;
};

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  ultra: { particles: 384, membrane: 256, marchingCubes: 56, volumeSteps: 96, pixelRatio: 2, ssrScale: 0.5, gtao: "high", shadows: "pcss-high" },
  high: { particles: 256, membrane: 192, marchingCubes: 48, volumeSteps: 72, pixelRatio: 1.5, ssrScale: 0.5, gtao: "medium", shadows: "pcss-medium" },
  medium: { particles: 192, membrane: 128, marchingCubes: 40, volumeSteps: 48, pixelRatio: 1.25, ssrScale: 0.25, gtao: "low", shadows: "pcf" },
  low: { particles: 128, membrane: 96, marchingCubes: 32, volumeSteps: 28, pixelRatio: 1, ssrScale: 0, gtao: "depth", shadows: "pcf" },
};

export function selectInitialTier(input: QualitySelectionInput): QualityTier {
  if (input.hardwareConcurrency <= 4 || (input.deviceMemory !== undefined && input.deviceMemory <= 4)) {
    return "low";
  }

  const physicalPixels = input.viewportPixels * input.devicePixelRatio ** 2;
  if (input.touch || physicalPixels > 8_000_000 || input.reducedMotion) {
    return "medium";
  }

  return "high";
}
