import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapShowcase } from "./main";
import type { ShowcaseAppOptions } from "./app/ShowcaseApp";

afterEach(() => { document.documentElement.replaceChildren(); delete document.documentElement.dataset.showcaseState; });

function page(): { canvas: HTMLCanvasElement; select: HTMLSelectElement; reset: HTMLButtonElement; hint: HTMLElement; status: HTMLElement } {
  document.documentElement.innerHTML = `<body><main id="showcase-root"><canvas id="showcase-canvas"></canvas><p class="showcase-status" role="status" aria-live="polite">Preparing Cosmic Genesis…</p><section class="showcase-controls"><p class="interaction-hint">Hint</p><select aria-label="Rendering quality"><option value="auto">Auto</option><option value="low">Low</option></select><button type="button">Reset view</button></section></main></body>`;
  const canvas = document.querySelector<HTMLCanvasElement>("#showcase-canvas")!;
  vi.spyOn(canvas, "getContext").mockReturnValue({} as WebGL2RenderingContext);
  return { canvas, select: document.querySelector("select")!, reset: document.querySelector("button")!, hint: document.querySelector(".interaction-hint")!, status: document.querySelector(".showcase-status")! };
}

describe("bootstrapShowcase", () => {
  it("detects capability before constructing the app and wires quality and reset controls", () => {
    const { select, reset } = page();
    const app = { start: vi.fn(), setQualityMode: vi.fn(), resetView: vi.fn(), dispose: vi.fn() };
    const createApp = vi.fn(() => app);

    bootstrapShowcase({ createApp, media: () => ({ matches: false }) as MediaQueryList });
    expect(createApp).toHaveBeenCalledOnce(); expect(app.start).toHaveBeenCalledOnce();
    select.value = "low"; select.dispatchEvent(new Event("change")); reset.click();
    expect(app.setQualityMode).toHaveBeenCalledWith("low"); expect(app.resetView).toHaveBeenCalledOnce();
  });

  it("keeps the fallback visible and does not construct WebGL systems when WebGL2 is unavailable", () => {
    const { canvas } = page(); vi.mocked(canvas.getContext).mockReturnValue(null);
    const createApp = vi.fn();
    bootstrapShowcase({ createApp, media: () => ({ matches: true }) as MediaQueryList });
    expect(createApp).not.toHaveBeenCalled(); expect(document.documentElement.dataset.showcaseState).toBe("fallback");
  });

  it("announces loading, hides status when ready, and exposes fallback errors", () => {
    const { status } = page();
    let appOptions: ShowcaseAppOptions | undefined;
    const app = { start: vi.fn(), setQualityMode: vi.fn(), resetView: vi.fn(), dispose: vi.fn() };
    bootstrapShowcase({ createApp: (options) => { appOptions = options; return app; }, media: () => ({ matches: false }) as MediaQueryList });
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Preparing");
    appOptions!.onStateChange?.("ready");
    expect(status.hidden).toBe(true);
    appOptions!.onStateChange?.("fallback", "GPU unavailable");
    expect(status.hidden).toBe(false);
    expect(status.textContent).toContain("GPU unavailable");
  });

  it("hides the interaction hint on first input", () => {
    const { hint, canvas } = page();
    bootstrapShowcase({ createApp: vi.fn(() => ({ start: vi.fn(), setQualityMode: vi.fn(), resetView: vi.fn(), dispose: vi.fn() })), media: () => ({ matches: false }) as MediaQueryList });
    canvas.dispatchEvent(new Event("pointerdown"));
    expect(hint.hidden).toBe(true);
  });

  it("enters fallback instead of leaking construction and quality-control errors", () => {
    page();
    expect(() => bootstrapShowcase({ createApp: () => { throw new Error("allocation failed"); }, media: () => ({ matches: false }) as MediaQueryList })).not.toThrow();
    expect(document.documentElement.dataset.showcaseState).toBe("fallback");

    const { select } = page();
    const app = { start: vi.fn(), setQualityMode: vi.fn(() => { throw new Error("quality failed"); }), resetView: vi.fn(), dispose: vi.fn() };
    bootstrapShowcase({ createApp: () => app, media: () => ({ matches: false }) as MediaQueryList });
    expect(() => { select.value = "low"; select.dispatchEvent(new Event("change")); }).not.toThrow();
    expect(document.documentElement.dataset.showcaseState).toBe("fallback"); expect(app.dispose).toHaveBeenCalledOnce();
  });

  it("registers shell listeners and timers for app-owned disposal", () => {
    vi.useFakeTimers();
    const { canvas, select, reset, hint } = page();
    const cleanups: Array<() => void> = [];
    const app = { start: vi.fn(), setQualityMode: vi.fn(), resetView: vi.fn(), dispose: vi.fn(() => cleanups.splice(0).forEach((cleanup) => cleanup())), registerCleanup: vi.fn((cleanup: () => void) => cleanups.push(cleanup)) };
    bootstrapShowcase({ createApp: () => app, media: () => ({ matches: false }) as MediaQueryList });
    expect(app.registerCleanup).toHaveBeenCalled();
    app.dispose(); app.dispose();
    select.value = "low"; select.dispatchEvent(new Event("change")); reset.click(); canvas.dispatchEvent(new Event("pointerdown")); window.dispatchEvent(new Event("keydown")); vi.advanceTimersByTime(6_000);
    expect(app.setQualityMode).not.toHaveBeenCalled(); expect(app.resetView).not.toHaveBeenCalled(); expect(hint.hidden).toBe(false);
    vi.useRealTimers();
  });
});
