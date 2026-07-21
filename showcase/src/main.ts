import { ShowcaseApp, type ShowcaseAppOptions } from "./app/ShowcaseApp";
import { detectCapabilities } from "./app/capabilities";
import type { QualityMode } from "./quality/qualityProfiles";
import "./styles.css";

type AppControls = Pick<ShowcaseApp, "start" | "setQualityMode" | "resetView" | "dispose">;
export type BootstrapOptions = {
  document?: Document;
  media?: typeof window.matchMedia;
  createApp?: (options: ShowcaseAppOptions) => AppControls;
};

/** Connects the static shell to the interactive scene after WebGL capability detection. */
export function bootstrapShowcase(options: BootstrapOptions = {}): AppControls | null {
  const activeDocument = options.document ?? document;
  const canvas = activeDocument.querySelector<HTMLCanvasElement>("#showcase-canvas");
  const root = activeDocument.documentElement;
  if (canvas === null) return null;

  const media = options.media ?? window.matchMedia.bind(window);
  const capabilities = detectCapabilities(canvas, media);
  if (!capabilities.webgl2) {
    root.dataset.showcaseState = "fallback";
    return null;
  }

  root.dataset.showcaseState = "loading";
  const app = (options.createApp ?? ((appOptions) => new ShowcaseApp(appOptions)))({
    canvas, root, capabilities,
    onStateChange: (state, message) => {
      root.dataset.showcaseState = state;
      if (message === undefined) delete root.dataset.showcaseError;
      else root.dataset.showcaseError = message;
    },
  });
  const quality = activeDocument.querySelector<HTMLSelectElement>("select[aria-label='Rendering quality']");
  quality?.addEventListener("change", () => app.setQualityMode(quality.value as QualityMode));
  activeDocument.querySelector<HTMLButtonElement>("button[type='button']")?.addEventListener("click", () => app.resetView());

  const hint = activeDocument.querySelector<HTMLElement>(".interaction-hint");
  const hideHint = (): void => { if (hint !== null) hint.hidden = true; };
  const hintTimer = window.setTimeout(hideHint, 6_000);
  const clearHint = (): void => { window.clearTimeout(hintTimer); hideHint(); };
  canvas.addEventListener("pointerdown", clearHint, { once: true });
  canvas.addEventListener("touchstart", clearHint, { once: true });
  window.addEventListener("keydown", clearHint, { once: true });
  app.start();
  return app;
}

if (import.meta.env.MODE !== "test") bootstrapShowcase();
