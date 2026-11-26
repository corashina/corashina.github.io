import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import styles from "../styles/canvas.module.scss";
import type { BackgroundController, SceneTheme } from "../three/backgroundScene";
import type { Theme } from "../theme/theme";

const sceneThemes: Record<Theme, SceneTheme> = {
  dark: {
    background: "#050810",
    blendMode: "additive",
    particle: "#729ece",
    signal: "#bbdcff",
    connection: "#405f8f",
  },
  white: {
    background: "#f5f7fc",
    blendMode: "normal",
    particle: "#7893be",
    signal: "#285fc7",
    connection: "#a5bbd8",
  },
};

/** Home gets a brighter, denser field that reacts more to the pointer. */
const livelySceneThemes: Record<Theme, SceneTheme> = {
  dark: { ...sceneThemes.dark, particle: "#86b2e2", signal: "#d4ecff", connection: "#5576aa" },
  white: { ...sceneThemes.white, particle: "#6585b8", connection: "#8faad0" },
};

const canvasOpacities: Record<Theme, string> = {
  dark: "0.30",
  white: "0.18",
};

const livelyCanvasOpacities: Record<Theme, string> = {
  dark: "0.72",
  white: "0.40",
};

// Home text sits in the left part of the screen, so only that area is dimmed.
const LIVELY_CONTENT_FOCUS = { centerX: 0.3, scale: 0.85 };
const DEFAULT_CONTENT_FOCUS = { centerX: 0.5, scale: 1 };

const pickSceneTheme = (theme: Theme, lively: boolean): SceneTheme =>
  (lively ? livelySceneThemes : sceneThemes)[theme];

const applyLiveliness = (controller: BackgroundController, theme: Theme, lively: boolean): void => {
  controller.setTheme(pickSceneTheme(theme, lively));
  const focus = lively ? LIVELY_CONTENT_FOCUS : DEFAULT_CONTENT_FOCUS;
  controller.setContentFocus(focus.centerX, focus.scale);
};

/** Livelier pointer response: faster moves count for more, and any move stirs the field a little. */
export const boostPointerSpeed = (speed: number): number => Math.min(1, speed * 1.8 + 0.12);

type BackgroundCanvasProps = {
  /** Brighter, more responsive field (used on Home). */
  lively?: boolean;
  ready?: boolean;
  theme: Theme;
};

const scheduleInitialization = (callback: () => void): (() => void) => {
  const browserWindow: Window = window;
  if ("requestIdleCallback" in window) {
    const handle = window.requestIdleCallback(callback, { timeout: 1_500 });
    return () => window.cancelIdleCallback(handle);
  }
  const handle = browserWindow.setTimeout(callback, 250);
  return () => browserWindow.clearTimeout(handle);
};

export function BackgroundCanvas({ lively = false, ready = true, theme }: BackgroundCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<BackgroundController | null>(null);
  const themeRef = useRef(theme);
  const livelyRef = useRef(lively);
  const [failed, setFailed] = useState(false);
  themeRef.current = theme;
  livelyRef.current = lively;

  useEffect(() => {
    if (!ready) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof WebGLRenderingContext === "undefined") {
      setFailed(true);
      return;
    }

    let controller: BackgroundController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onPointerMove: ((event: PointerEvent) => void) | null = null;
    let onVisibilityChange: (() => void) | null = null;
    let pointerListenerAttached = false;
    let visibilityListenerAttached = false;
    let closed = false;
    let controllerDisposed = false;
    let previousPointer: { x: number; y: number; time: number } | null = null;

    const teardown = (): void => {
      closed = true;
      previousPointer = null;
      try {
        resizeObserver?.disconnect();
      } catch {
        // Continue releasing the controller if observer cleanup fails.
      }
      resizeObserver = null;

      if (pointerListenerAttached) {
        pointerListenerAttached = false;
        try {
          if (onPointerMove) {
            window.removeEventListener("pointermove", onPointerMove);
          }
        } catch {
          // Continue tearing down the remaining integration.
        }
      }
      if (visibilityListenerAttached) {
        visibilityListenerAttached = false;
        try {
          if (onVisibilityChange) {
            document.removeEventListener("visibilitychange", onVisibilityChange);
          }
        } catch {
          // Continue tearing down the remaining integration.
        }
      }

      const activeController = controller;
      controller = null;
      if (controllerRef.current === activeController) controllerRef.current = null;
      if (activeController && !controllerDisposed) {
        controllerDisposed = true;
        try {
          activeController.dispose();
        } catch {
          // The integration is already closed and must stay in fallback mode.
        }
      }
    };

    const failIntegration = (): void => {
      if (closed) return;
      setFailed(true);
      teardown();
    };

    const initialize = async (): Promise<void> => {
      try {
        const {
          createBackgroundScene,
          normalizePointer,
          normalizePointerSpeed,
        } = await import("../three/backgroundScene");
        if (closed) return;

        controller = createBackgroundScene(canvas, {
          onFailure: failIntegration,
        });

        if (closed) {
          teardown();
          return;
        }

        controllerRef.current = controller;
        applyLiveliness(controller, themeRef.current, livelyRef.current);

        onPointerMove = (event: PointerEvent): void => {
          if (closed) return;
          if (event.pointerType === "touch") {
            previousPointer = null;
            return;
          }
          if (!controller) return;
          const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const pointer = normalizePointer(event.clientX, event.clientY, rect);
          const measuredSpeed = previousPointer
            ? normalizePointerSpeed(
                event.clientX - previousPointer.x,
                event.clientY - previousPointer.y,
                event.timeStamp - previousPointer.time,
                rect,
              )
            : 0;
          const speed = livelyRef.current ? boostPointerSpeed(measuredSpeed) : measuredSpeed;
          previousPointer = {
            x: event.clientX,
            y: event.clientY,
            time: event.timeStamp,
          };
          controller.setPointer(pointer.x, pointer.y, speed);
        };

        onVisibilityChange = (): void => {
          if (closed || !controller) return;
          if (document.visibilityState === "hidden") {
            previousPointer = null;
            controller.stop();
          } else {
            controller.start();
          }
        };

        resizeObserver = new ResizeObserver(([entry]) => {
          if (closed || !controller || !entry) return;
          try {
            controller.resize(
              entry.contentRect.width,
              entry.contentRect.height,
              window.devicePixelRatio,
            );
          } catch {
            failIntegration();
          }
        });

        resizeObserver.observe(canvas);
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        pointerListenerAttached = true;
        document.addEventListener("visibilitychange", onVisibilityChange);
        visibilityListenerAttached = true;

        if (document.visibilityState !== "hidden") {
          controller.start();
        }
      } catch {
        if (!closed) {
          setFailed(true);
          teardown();
        }
      }
    };

    let cancelInitialization: (() => void) | null = scheduleInitialization(() => {
      cancelInitialization = null;
      void initialize();
    });

    return () => {
      cancelInitialization?.();
      cancelInitialization = null;
      teardown();
    };
  }, [ready]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    applyLiveliness(controller, theme, lively);
  }, [lively, theme]);

  return (
    <canvas
      aria-hidden="true"
      className={styles.canvas}
      data-testid="background-canvas"
      hidden={failed}
      ref={canvasRef}
      style={{
        "--canvas-background": sceneThemes[theme].background,
        "--canvas-opacity": (lively ? livelyCanvasOpacities : canvasOpacities)[theme],
      } as CSSProperties}
    />
  );
}
