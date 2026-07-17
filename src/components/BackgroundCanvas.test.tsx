import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundController } from "../three/backgroundScene";
import { BackgroundCanvas } from "./BackgroundCanvas";

const sceneMocks = vi.hoisted(() => ({
  createBackgroundScene: vi.fn(),
}));

vi.mock("../three/backgroundScene", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../three/backgroundScene")>()),
  createBackgroundScene: sceneMocks.createBackgroundScene,
}));

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
    controller = createController();
    sceneMocks.createBackgroundScene.mockReset();
    sceneMocks.createBackgroundScene.mockReturnValue(controller);
    observe.mockReset();
    disconnect.mockReset();

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
    vi.unstubAllGlobals();
  });

  it("creates an aria-hidden scene, observes its size, starts, and fully disposes", () => {
    const { unmount } = render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas");

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

  it("renders one stable frame and never starts animation for reduced motion", () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 200,
      height: 100,
    } as DOMRect);
    act(() => window.dispatchEvent(new MouseEvent("pointermove", { clientX: 200, clientY: 0 })));

    expect(sceneMocks.createBackgroundScene).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({ staticQuality: "medium" }),
    );
    expect(controller.renderStatic).toHaveBeenCalledOnce();
    expect(controller.start).not.toHaveBeenCalled();
    expect(controller.setPointer).not.toHaveBeenCalled();
  });

  it("stops while hidden and restarts when visible", () => {
    render(<BackgroundCanvas theme="dark" />);

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(controller.stop).toHaveBeenCalledOnce();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(controller.start).toHaveBeenCalledTimes(2);
  });

  it("resizes from its observer without changing CSS dimensions", () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;

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

  it("passes normalized pointer position and capped speed", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
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

  it("forgets pointer velocity while the document is hidden", () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
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

  it("keeps touch scrolling autonomous and resets the next mouse velocity sample", () => {
    render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
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

  it("maps dark and white themes to the constellation palette", () => {
    const { rerender } = render(<BackgroundCanvas theme="dark" />);
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

  it("hides the decorative canvas when WebGL creation fails", () => {
    sceneMocks.createBackgroundScene.mockImplementationOnce(() => {
      throw new Error("WebGL unavailable");
    });

    render(<BackgroundCanvas theme="dark" />);

    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
    expect(observe).not.toHaveBeenCalled();
  });

  it("tears down every scene integration after an asynchronous failure", () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = render(<BackgroundCanvas theme="dark" />);
    const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
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

  it("disposes a scene that reports failure during initialization", () => {
    sceneMocks.createBackgroundScene.mockImplementationOnce((_canvas, options) => {
      options.onFailure(new Error("initialization failed"));
      return controller;
    });

    const { unmount } = render(<BackgroundCanvas theme="dark" />);

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

  it("removes pointer and visibility listeners during cleanup", () => {
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<BackgroundCanvas theme="dark" />);

    unmount();

    expect(removeWindowListener).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
  });
});
