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

  it("hides without creating a scene when WebGL is unsupported", () => {
    vi.stubGlobal("WebGLRenderingContext", undefined);

    render(<BackgroundCanvas theme="dark" />);

    expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();
    expect(screen.getByTestId("background-canvas")).not.toBeVisible();
  });

});
