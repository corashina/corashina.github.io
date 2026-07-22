import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShowcaseAppOptions } from "./app/ShowcaseApp";
import { bootstrapShowcase } from "./main";

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.replaceChildren();
  for (const key of Object.keys(document.documentElement.dataset)) delete document.documentElement.dataset[key];
});

function page(): { canvas: HTMLCanvasElement; reset: HTMLButtonElement; hint: HTMLElement; status: HTMLElement } {
  document.documentElement.innerHTML = `<body><main id="showcase-root"><canvas id="showcase-canvas"></canvas><p class="showcase-status" role="status" aria-live="polite">Preparing Cosmic Genesis…</p><section class="showcase-controls"><p class="interaction-hint">Drag to orbit · Scroll to zoom · Click or tap to pulse</p><button type="button">Reset view</button></section></main></body>`;
  const canvas = document.querySelector<HTMLCanvasElement>("#showcase-canvas")!;
  vi.spyOn(canvas, "getContext").mockReturnValue({} as WebGL2RenderingContext);
  return { canvas, reset: document.querySelector("button")!, hint: document.querySelector(".interaction-hint")!, status: document.querySelector(".showcase-status")! };
}

describe("bootstrapShowcase", () => {
  it("detects capability, starts the particle app, and wires Reset View without quality controls", () => {
    const { reset } = page();
    const app = { start: vi.fn(), resetView: vi.fn(), dispose: vi.fn() };
    const createApp = vi.fn(() => app);

    bootstrapShowcase({ createApp, media: () => ({ matches: false }) as MediaQueryList });
    reset.click();

    expect(createApp).toHaveBeenCalledOnce();
    expect(app.start).toHaveBeenCalledOnce();
    expect(app.resetView).toHaveBeenCalledOnce();
    expect(document.querySelector("select")).toBeNull();
  });

  it("keeps fallback visible without constructing GPU systems when WebGL2 is unavailable", () => {
    const { canvas } = page();
    vi.mocked(canvas.getContext).mockReturnValue(null);
    const createApp = vi.fn();

    bootstrapShowcase({ createApp, media: () => ({ matches: true }) as MediaQueryList });

    expect(createApp).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.showcaseState).toBe("fallback");
  });

  it("announces loading, hides status when ready, and exposes fallback errors", () => {
    const { status } = page();
    let appOptions: ShowcaseAppOptions | undefined;
    const app = { start: vi.fn(), resetView: vi.fn(), dispose: vi.fn() };
    bootstrapShowcase({ createApp: (options) => { appOptions = options; return app; }, media: () => ({ matches: false }) as MediaQueryList });

    expect(status.getAttribute("role")).toBe("status");
    expect(status.textContent).toContain("Preparing");
    appOptions!.onStateChange?.("ready");
    expect(status.hidden).toBe(true);
    appOptions!.onStateChange?.("fallback", "GPU unavailable");
    expect(status.textContent).toContain("GPU unavailable");
  });

  it("hides the interaction hint on first input", () => {
    const { hint, canvas } = page();
    bootstrapShowcase({ createApp: () => ({ start: vi.fn(), resetView: vi.fn(), dispose: vi.fn() }), media: () => ({ matches: false }) as MediaQueryList });
    canvas.dispatchEvent(new Event("pointerdown"));
    expect(hint.hidden).toBe(true);
  });

  it("enters fallback instead of leaking construction or reset errors", () => {
    page();
    expect(() => bootstrapShowcase({ createApp: () => { throw new Error("allocation failed"); }, media: () => ({ matches: false }) as MediaQueryList })).not.toThrow();
    expect(document.documentElement.dataset.showcaseState).toBe("fallback");

    const { reset } = page();
    const app = { start: vi.fn(), resetView: vi.fn(() => { throw new Error("reset failed"); }), dispose: vi.fn() };
    bootstrapShowcase({ createApp: () => app, media: () => ({ matches: false }) as MediaQueryList });
    expect(() => reset.click()).not.toThrow();
    expect(document.documentElement.dataset.showcaseState).toBe("fallback");
    expect(app.dispose).toHaveBeenCalledOnce();
  });

  it("registers shell listeners and timers for app-owned disposal", () => {
    vi.useFakeTimers();
    const { canvas, reset, hint } = page();
    const cleanups: Array<() => void> = [];
    const app = {
      start: vi.fn(), resetView: vi.fn(),
      dispose: vi.fn(() => cleanups.splice(0).forEach((cleanup) => cleanup())),
      registerCleanup: vi.fn((cleanup: () => void) => cleanups.push(cleanup)),
    };
    bootstrapShowcase({ createApp: () => app, media: () => ({ matches: false }) as MediaQueryList });

    app.dispose(); app.dispose();
    reset.click(); canvas.dispatchEvent(new Event("pointerdown")); window.dispatchEvent(new Event("keydown")); vi.advanceTimersByTime(6_000);

    expect(app.resetView).not.toHaveBeenCalled();
    expect(hint.hidden).toBe(false);
  });
});
