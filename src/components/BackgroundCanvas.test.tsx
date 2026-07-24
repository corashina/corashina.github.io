import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundController } from "../three/backgroundScene";
import { BackgroundCanvas } from "./BackgroundCanvas";

const sceneMocks = vi.hoisted(() => ({
  createBackgroundScene: vi.fn(),
}));

vi.mock("../three/backgroundScene", () => ({
  createBackgroundScene: sceneMocks.createBackgroundScene,
  normalizePointer: (clientX: number, clientY: number, rect: DOMRect) => ({
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: 1 - ((clientY - rect.top) / rect.height) * 2,
  }),
  normalizePointerSpeed: (
    deltaX: number,
    deltaY: number,
    deltaMs: number,
    rect: DOMRect,
  ) => {
    if (deltaMs <= 0 || rect.width <= 0 || rect.height <= 0) return 0;
    const normalizedDistance = Math.hypot(deltaX / rect.width, deltaY / rect.height);
    return Math.min(normalizedDistance / (deltaMs / 1_000), 1);
  },
}));

let idleCallback: IdleRequestCallback;
const cancelIdleCallback = vi.fn();

async function flushBackgroundIdle(): Promise<void> {
  await act(async () => {
    idleCallback({
      didTimeout: false,
      timeRemaining: () => 20,
    });
    await Promise.resolve();
  });
}

function createController(): BackgroundController {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    resize: vi.fn(),
    setPointer: vi.fn(),
    setTheme: vi.fn(),
    renderStatic: vi.fn(),
    dispose: vi.fn(),
  };
}

function pointerMove(clientX: number, clientY: number, timeStamp: number): MouseEvent {
  const event = new MouseEvent("pointermove", { clientX, clientY });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  return event;
}

function touchPointerMove(clientX: number, clientY: number, timeStamp: number): MouseEvent {
  const event = pointerMove(clientX, clientY, timeStamp);
  Object.defineProperty(event, "pointerType", { value: "touch" });
  return event;
}

describe("BackgroundCanvas", () => {
  let controller: BackgroundController;
  let resizeCallback: ResizeObserverCallback;
  const observe = vi.fn();
  const disconnect = vi.fn();

  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    controller = createController();
    sceneMocks.createBackgroundScene.mockReset();
    sceneMocks.createBackgroundScene.mockReturnValue(controller);
    observe.mockReset();
    disconnect.mockReset();
    cancelIdleCallback.mockReset();
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 41;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback);

    class ResizeObserverStub implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContextStub {});
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    vi.unstubAllGlobals();
  });

  it("does not import or create the scene before idle", () => {
    render(<BackgroundCanvas theme="dark" />);
    expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();
  });

  it("cancels scheduled initialization when unmounted", () => {
    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    unmount();
    expect(cancelIdleCallback).toHaveBeenCalledWith(41);
    expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();
  });

  it("creates an aria-hidden scene, observes its size, starts, and fully disposes", async () => {
    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas");
    await flushBackgroundIdle();

    expect(canvas).toHaveAttribute("aria-hidden", "true");
    expect(sceneMocks.createBackgroundScene).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({ onFailure: expect.any(Function) }),
    );
    expect(observe).toHaveBeenCalledWith(canvas);
    expect(controller.start).toHaveBeenCalledOnce();

    unmount();

    expect(disconnect).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("renders one static scene for reduced motion", async () => {
    const addWindowListener = vi.spyOn(window, "addEventListener");
    const addDocumentListener = vi.spyOn(document, "addEventListener");
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas");
    await flushBackgroundIdle();
    expect(sceneMocks.createBackgroundScene).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({ staticQuality: "medium" }),
    );
    expect(observe).toHaveBeenCalledWith(canvas);
    expect(controller.renderStatic).toHaveBeenCalledOnce();
    expect(controller.start).not.toHaveBeenCalled();
    expect(addWindowListener).not.toHaveBeenCalledWith(
      "pointermove",
      expect.any(Function),
      expect.anything(),
    );
    expect(addDocumentListener).not.toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });

  it("initializes after the 250 ms timeout fallback", async () => {
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", class ResizeObserverFallbackStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    });
    vi.stubGlobal("devicePixelRatio", 2);
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContextFallbackStub {});
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));

    render(<BackgroundCanvas theme="dark" />);
    expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(250);
      await vi.runAllTimersAsync();
    });
    expect(sceneMocks.createBackgroundScene).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("stops while hidden and restarts when visible", async () => {
    render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(controller.stop).toHaveBeenCalledOnce();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(controller.start).toHaveBeenCalledTimes(2);
  });

  it("resizes from its observer without changing CSS dimensions", async () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    await flushBackgroundIdle();

    act(() => {
      resizeCallback(
        [{ contentRect: { width: 900, height: 600 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    });

    expect(controller.resize).toHaveBeenCalledWith(900, 600, 2);
    expect(canvas.style.width).toBe("");
    expect(canvas.style.height).toBe("");
  });

  it("passes normalized pointer position and capped speed", async () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    await flushBackgroundIdle();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1_000,
      height: 500,
    } as DOMRect);

    act(() => window.dispatchEvent(pointerMove(100, 100, 100)));
    act(() => window.dispatchEvent(pointerMove(200, 100, 300)));

    expect(addEventListener).toHaveBeenCalledWith("pointermove", expect.any(Function), {
      passive: true,
    });
    expect(controller.setPointer).toHaveBeenNthCalledWith(1, -0.8, 0.6, 0);
    const [x, y, speed] = vi.mocked(controller.setPointer).mock.calls.at(-1) ?? [];
    expect(x).toBeCloseTo(-0.6);
    expect(y).toBeCloseTo(0.6);
    expect(speed).toBeCloseTo(0.5);
    expect(speed).toBeGreaterThanOrEqual(0);
    expect(speed).toBeLessThanOrEqual(1);
  });

  it("forgets pointer velocity while the document is hidden", async () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    await flushBackgroundIdle();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1_000,
      height: 500,
    } as DOMRect);

    act(() => window.dispatchEvent(pointerMove(100, 100, 100)));
    act(() => window.dispatchEvent(pointerMove(200, 100, 300)));

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => window.dispatchEvent(pointerMove(800, 100, 1_000)));

    const pointerCalls = vi.mocked(controller.setPointer).mock.calls;
    expect(pointerCalls.map(([, , speed]) => speed)).toEqual([0, 0.5, 0]);
    expect(pointerCalls.at(-1)?.[0]).toBeCloseTo(0.6);
    expect(pointerCalls.at(-1)?.[1]).toBeCloseTo(0.6);
  });

  it("keeps touch scrolling autonomous and resets the next mouse velocity sample", async () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    await flushBackgroundIdle();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 1_000,
      height: 500,
    } as DOMRect);

    act(() => window.dispatchEvent(pointerMove(100, 100, 100)));
    act(() => window.dispatchEvent(touchPointerMove(600, 100, 200)));
    act(() => window.dispatchEvent(pointerMove(700, 100, 300)));

    expect(controller.setPointer).toHaveBeenCalledTimes(2);
    expect(vi.mocked(controller.setPointer).mock.calls.map(([, , speed]) => speed)).toEqual([
      0,
      0,
    ]);
  });

  it("maps dark and white themes to the constellation palette", async () => {
    const { rerender } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();
    expect(controller.setTheme).toHaveBeenLastCalledWith({
      background: "#222222",
      blendMode: "additive",
      particle: "#aeb4ba",
      signal: "#f4f6f7",
      connection: "#697078",
    });

    rerender(<BackgroundCanvas theme="white" />);

    expect(controller.setTheme).toHaveBeenLastCalledWith({
      background: "#ffffff",
      blendMode: "normal",
      particle: "#7d848a",
      signal: "#272b2e",
      connection: "#a2a7ac",
    });
  });

  it("applies the approved presentation opacity for each theme", () => {
    const { rerender } = render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas");

    expect(canvas).toHaveStyle({ "--canvas-opacity": "0.58" });

    rerender(<BackgroundCanvas theme="white" />);

    expect(canvas).toHaveStyle({ "--canvas-opacity": "0.38" });
  });

  it("hides the decorative canvas when WebGL creation fails", async () => {
    sceneMocks.createBackgroundScene.mockImplementationOnce(() => {
      throw new Error("WebGL unavailable");
    });

    render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(observe).not.toHaveBeenCalled();
  });

  it("falls back and disposes once when ResizeObserver construction fails", async () => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverConstructionFailure {
        constructor() {
          throw new Error("ResizeObserver construction failed");
        }
      },
    );

    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(controller.start).not.toHaveBeenCalled();
    expect(controller.dispose).toHaveBeenCalledOnce();

    unmount();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("falls back and disposes once when observing the canvas fails", async () => {
    observe.mockImplementationOnce(() => {
      throw new Error("observe failed");
    });

    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(controller.start).not.toHaveBeenCalled();
    expect(controller.dispose).toHaveBeenCalledOnce();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("contains resize failures and tears down the running integration once", async () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    vi.mocked(controller.resize).mockImplementationOnce(() => {
      throw new Error("resize failed");
    });
    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    expect(() => {
      act(() => {
        resizeCallback(
          [{ contentRect: { width: 900, height: 600 } } as ResizeObserverEntry],
          {} as ResizeObserver,
        );
      });
    }).not.toThrow();

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeWindowListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(controller.dispose).toHaveBeenCalledOnce();

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("tears down every scene integration after an asynchronous failure", async () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    await flushBackgroundIdle();
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect);
    const options = sceneMocks.createBackgroundScene.mock.calls[0]?.[1] as {
      onFailure(error: unknown): void;
    };

    act(() => options.onFailure(new Error("render failed")));

    expect(canvas).not.toBeVisible();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeWindowListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(controller.dispose).toHaveBeenCalledOnce();

    const callsAfterFailure = {
      renderStatic: vi.mocked(controller.renderStatic).mock.calls.length,
      resize: vi.mocked(controller.resize).mock.calls.length,
      setPointer: vi.mocked(controller.setPointer).mock.calls.length,
      setTheme: vi.mocked(controller.setTheme).mock.calls.length,
      start: vi.mocked(controller.start).mock.calls.length,
      stop: vi.mocked(controller.stop).mock.calls.length,
    };

    act(() => {
      resizeCallback(
        [{ contentRect: { width: 900, height: 600 } } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 0 }));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    rerender(<BackgroundCanvas theme="white" />);

    expect(controller.renderStatic).toHaveBeenCalledTimes(callsAfterFailure.renderStatic);
    expect(controller.resize).toHaveBeenCalledTimes(callsAfterFailure.resize);
    expect(controller.setPointer).toHaveBeenCalledTimes(callsAfterFailure.setPointer);
    expect(controller.setTheme).toHaveBeenCalledTimes(callsAfterFailure.setTheme);
    expect(controller.start).toHaveBeenCalledTimes(callsAfterFailure.start);
    expect(controller.stop).toHaveBeenCalledTimes(callsAfterFailure.stop);

    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("disposes a scene that reports failure during initialization", async () => {
    sceneMocks.createBackgroundScene.mockImplementationOnce((_canvas, options) => {
      options.onFailure(new Error("initialization failed"));
      return controller;
    });

    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(observe).not.toHaveBeenCalled();
    expect(controller.start).not.toHaveBeenCalled();
    expect(controller.dispose).toHaveBeenCalledOnce();

    unmount();
    expect(controller.dispose).toHaveBeenCalledOnce();
  });

  it("hides without creating a scene when WebGL is unsupported", () => {
    vi.stubGlobal("WebGLRenderingContext", undefined);

    render(<BackgroundCanvas theme="dark" />);

    expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();
    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
  });

  it("removes pointer and visibility listeners during cleanup", async () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    await flushBackgroundIdle();

    unmount();

    expect(removeWindowListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
