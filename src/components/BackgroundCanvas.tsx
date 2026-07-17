import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import styles from "../styles/canvas.module.scss";
import {
  createBackgroundScene,
  normalizePointer,
  type BackgroundController,
  type SceneTheme,
} from "../three/backgroundScene";
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
  dark: "0.42",
  white: "0.28",
};

type BackgroundCanvasProps = {
  theme: Theme;
};

export function BackgroundCanvas({ theme }: BackgroundCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<BackgroundController | null>(null);
  const reducedMotionRef = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof WebGLRenderingContext === "undefined") {
      setFailed(true);
      return;
    }

    const reducedMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    reducedMotionRef.current = reducedMotion;

    let controller: BackgroundController | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let listenersAttached = false;
    let closed = false;
    let controllerDisposed = false;

    const onPointerMove = (event: PointerEvent): void => {
      if (closed || reducedMotion || !controller) return;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const pointer = normalizePointer(event.clientX, event.clientY, rect);
      controller.setPointer(pointer.x, pointer.y, 0);
    };

    const onVisibilityChange = (): void => {
      if (closed || !controller) return;
      if (document.visibilityState === "hidden") {
        controller.stop();
      } else if (reducedMotion) {
        controller.renderStatic();
      } else {
        controller.start();
      }
    };

    const teardown = (): void => {
      closed = true;
      resizeObserver?.disconnect();
      resizeObserver = null;

      if (listenersAttached) {
        window.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        listenersAttached = false;
      }

      const activeController = controller;
      controller = null;
      if (controllerRef.current === activeController) controllerRef.current = null;
      if (activeController && !controllerDisposed) {
        controllerDisposed = true;
        activeController.dispose();
      }
    };

    try {
      controller = createBackgroundScene(canvas, {
        onFailure: () => {
          setFailed(true);
          teardown();
        },
      });
    } catch {
      setFailed(true);
      teardown();
      return teardown;
    }

    if (closed) {
      teardown();
      return teardown;
    }

    controllerRef.current = controller;

    resizeObserver = new ResizeObserver(([entry]) => {
      if (closed || !controller || !entry) return;
      controller.resize(entry.contentRect.width, entry.contentRect.height, window.devicePixelRatio);
      if (reducedMotion) controller.renderStatic();
    });

    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    listenersAttached = true;

    if (!reducedMotion && document.visibilityState !== "hidden") {
      controller.start();
    }

    return teardown;
  }, []);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.setTheme(sceneThemes[theme]);
    if (reducedMotionRef.current) controller.renderStatic();
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
