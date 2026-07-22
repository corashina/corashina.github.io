import { ShowcaseApp, type ShowcaseAppOptions } from "./app/ShowcaseApp";
import { detectCapabilities } from "./app/capabilities";
import type { QualityMode } from "./quality/qualityProfiles";
import "./styles.css";

type AppControls = Pick<ShowcaseApp, "start" | "setQualityMode" | "resetView" | "dispose"> & { registerCleanup?: (cleanup: () => void) => void };
export type BootstrapOptions = {
  document?: Document;
  media?: typeof window.matchMedia;
  createApp?: (options: ShowcaseAppOptions) => AppControls;
  testMode?: boolean;
};

/** Connects the static shell to the interactive scene after WebGL capability detection. */
export function bootstrapShowcase(options: BootstrapOptions = {}): AppControls | null {
  const activeDocument = options.document ?? document;
  const canvas = activeDocument.querySelector<HTMLCanvasElement>("#showcase-canvas");
  const root = activeDocument.documentElement;
  if (canvas === null) return null;

  const media = options.media ?? window.matchMedia.bind(window);
  const query = new URLSearchParams(activeDocument.defaultView?.location.search ?? window.location.search);
  const testMode = options.testMode ?? query.get("test") === "1";
  const capabilities = detectCapabilities(canvas, media);
  const clearTestTelemetry = (): void => {
    for (const key of ["showcaseReady", "qualityTier", "lastPulse", "lastReset", "reducedMotion", "showcaseLayers", "renderedFrames", "lastOrbit", "lastZoom"] as const) delete root.dataset[key];
  };
  const showFallback = (message: string, app?: AppControls): null => {
    try { app?.dispose(); } catch { /* preserve the original failure state */ }
    clearTestTelemetry();
    root.dataset.showcaseState = "fallback";
    root.dataset.showcaseError = message;
    return null;
  };
  if (!capabilities.webgl2) return showFallback("WebGL 2 is unavailable.");

  root.dataset.showcaseState = "loading";
  let app: AppControls;
  try {
    app = (options.createApp ?? ((appOptions) => new ShowcaseApp(appOptions)))({
      canvas, root, capabilities, testMode,
      onStateChange: (state, message) => {
        root.dataset.showcaseState = state;
        if (message === undefined) delete root.dataset.showcaseError;
        else root.dataset.showcaseError = message;
      },
    });
  } catch (error) {
    return showFallback(error instanceof Error ? error.message : "The interactive scene could not be created.");
  }
  const quality = activeDocument.querySelector<HTMLSelectElement>("select[aria-label='Rendering quality']");
  const reset = activeDocument.querySelector<HTMLButtonElement>("button[type='button']");
  const onQualityChange = (): void => { try { app.setQualityMode(quality!.value as QualityMode); } catch (error) { showFallback(error instanceof Error ? error.message : "Quality selection failed.", app); } };
  const onReset = (): void => { try { app.resetView(); } catch (error) { showFallback(error instanceof Error ? error.message : "View reset failed.", app); } };
  quality?.addEventListener("change", onQualityChange);
  reset?.addEventListener("click", onReset);
  const requestedQuality = query.get("quality") as QualityMode | null;
  if (testMode && requestedQuality !== null && ["auto", "ultra", "high", "medium", "low"].includes(requestedQuality)) {
    if (quality !== null) quality.value = requestedQuality;
    onQualityChange();
  }

  const hint = activeDocument.querySelector<HTMLElement>(".interaction-hint");
  const hideHint = (): void => { if (hint !== null) hint.hidden = true; };
  const hintTimer = window.setTimeout(hideHint, 6_000);
  const clearHint = (): void => { window.clearTimeout(hintTimer); hideHint(); };
  canvas.addEventListener("pointerdown", clearHint, { once: true });
  canvas.addEventListener("touchstart", clearHint, { once: true });
  window.addEventListener("keydown", clearHint, { once: true });
  app.registerCleanup?.(() => {
    quality?.removeEventListener("change", onQualityChange); reset?.removeEventListener("click", onReset);
    canvas.removeEventListener("pointerdown", clearHint); canvas.removeEventListener("touchstart", clearHint);
    window.removeEventListener("keydown", clearHint); window.clearTimeout(hintTimer);
  });
  try { app.start(); } catch (error) { return showFallback(error instanceof Error ? error.message : "The interactive scene could not start.", app); }
  return app;
}

if (import.meta.env.MODE !== "test") bootstrapShowcase();
