export type CapabilityReport = { webgl2: boolean; reducedMotion: boolean };

export function detectCapabilities(
  canvas: HTMLCanvasElement,
  media: typeof window.matchMedia,
): CapabilityReport {
  return {
    webgl2: canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) !== null,
    reducedMotion: media("(prefers-reduced-motion: reduce)").matches,
  };
}
