import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import styles from "../styles/canvas.module.scss";
import type { BackgroundController, SceneTheme } from "../three/backgroundScene";
import type { Theme } from "../theme/theme";

const sceneThemes: Record<Theme, SceneTheme> = {
  dark: {
    background: "#222222",
    blendMode: "additive",
    particle: "#aeb4ba",
    signal: "#f4f6f7",
    connection: "#697078",
  },
  white: {
    background: "#ffffff",
    blendMode: "normal",
    particle: "#7d848a",
    signal: "#272b2e",
    connection: "#a2a7ac",
  },
};

const canvasOpacities: Record<Theme, string> = {
  dark: "0.58",
  white: "0.38",
};

type BackgroundCanvasProps = {
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

export function BackgroundCanvas({ ready = true, theme }: BackgroundCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<BackgroundController | null>(null);
  const themeRef = useRef(theme);
  const [failed, setFailed] = useState(false);
  themeRef.current = theme;

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

        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        controller = createBackgroundScene(canvas, {
          onFailure: failIntegration,
          ...(reducedMotion ? { staticQuality: "medium" as const } : {}),
        });

        if (closed) {
          teardown();
          return;
        }

        controllerRef.current = controller;
        controller.setTheme(sceneThemes[themeRef.current]);

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
          const speed = previousPointer
            ? normalizePointerSpeed(
                event.clientX - previousPointer.x,
                event.clientY - previousPointer.y,
                event.timeStamp - previousPointer.time,
                rect,
              )
            : 0;
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
            if (reducedMotion) controller.renderStatic();
          } catch {
            failIntegration();
          }
        });

        resizeObserver.observe(canvas);
        if (reducedMotion) {
          controller.renderStatic();
          return;
        }

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
    controller.setTheme(sceneThemes[theme]);
  }, [theme]);

  return (
    <canvas
      aria-hidden="true"
      className={styles.canvas}
      data-testid="background-canvas"
      hidden={failed}
      ref={canvasRef}
      style={{
        "--canvas-background": sceneThemes[theme].background,
        "--canvas-opacity": canvasOpacities[theme],
      } as CSSProperties}
    />
  );
}
