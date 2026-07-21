import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapShowcase } from "./main";

afterEach(() => { document.documentElement.replaceChildren(); delete document.documentElement.dataset.showcaseState; });

function page(): { canvas: HTMLCanvasElement; select: HTMLSelectElement; reset: HTMLButtonElement; hint: HTMLElement } {
  document.documentElement.innerHTML = `<body><main id="showcase-root"><canvas id="showcase-canvas"></canvas><section class="showcase-controls"><p class="interaction-hint">Hint</p><select aria-label="Rendering quality"><option value="auto">Auto</option><option value="low">Low</option></select><button type="button">Reset view</button></section></main></body>`;
  const canvas = document.querySelector<HTMLCanvasElement>("#showcase-canvas")!;
  vi.spyOn(canvas, "getContext").mockReturnValue({} as WebGL2RenderingContext);
  return { canvas, select: document.querySelector("select")!, reset: document.querySelector("button")!, hint: document.querySelector(".interaction-hint")! };
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

  it("hides the interaction hint on first input", () => {
    const { hint, canvas } = page();
    bootstrapShowcase({ createApp: vi.fn(() => ({ start: vi.fn(), setQualityMode: vi.fn(), resetView: vi.fn(), dispose: vi.fn() })), media: () => ({ matches: false }) as MediaQueryList });
    canvas.dispatchEvent(new Event("pointerdown"));
    expect(hint.hidden).toBe(true);
  });
});
