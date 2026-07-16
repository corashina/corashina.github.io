import * as THREE from "three";
import { fragmentShader, vertexShader } from "./shaders";

export type SceneTheme = {
  wire: THREE.ColorRepresentation;
  background: THREE.ColorRepresentation;
};

export type BackgroundController = {
  start(): void;
  stop(): void;
  resize(width: number, height: number, pixelRatio: number): void;
  setPointer(x: number, y: number): void;
  setTheme(theme: SceneTheme): void;
  renderStatic(): void;
  dispose(): void;
};

export type BackgroundSceneDependencies = {
  createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer;
  requestFrame(callback: FrameRequestCallback): number;
  cancelFrame(handle: number): void;
};

export type BackgroundSceneOptions = Partial<BackgroundSceneDependencies> & {
  onFailure?(error: unknown): void;
};

export const capPixelRatio = (value: number): number =>
  Math.min(Math.max(value, 1), 1.5);

export const normalizePointer = (
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } => ({
  x: ((clientX - rect.left) / rect.width) * 2 - 1,
  y: 1 - ((clientY - rect.top) / rect.height) * 2,
});

const defaultDependencies: BackgroundSceneDependencies = {
  createRenderer: (canvas) =>
    new THREE.WebGLRenderer({
      antialias: true,
      canvas,
    }),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

export function createBackgroundScene(
  canvas: HTMLCanvasElement,
  options: BackgroundSceneOptions = {},
): BackgroundController {
  const createRenderer = options.createRenderer ?? defaultDependencies.createRenderer;
  const requestFrame = options.requestFrame ?? defaultDependencies.requestFrame;
  const cancelFrame = options.cancelFrame ?? defaultDependencies.cancelFrame;
  const onFailure = options.onFailure ?? (() => undefined);
  const renderer = createRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
  const baseCameraY = -180;
  camera.position.set(0, baseCameraY, 1050);

  const geometry = new THREE.PlaneGeometry(3600, 2400, 120, 80);
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  const wireColor = new THREE.Color("#555555");
  const wireTarget = new THREE.Color("#555555");
  const clearColor = new THREE.Color("#222222");
  const clearTarget = new THREE.Color("#222222");

  const createMaterial = (amplitude: number, opacity: number): THREE.ShaderMaterial =>
    new THREE.ShaderMaterial({
      fragmentShader,
      transparent: true,
      uniforms: {
        uAmplitude: { value: amplitude },
        uColor: { value: wireColor },
        uOpacity: { value: opacity },
        uPointer: { value: pointer },
        uTime: { value: 0 },
      },
      vertexShader,
      wireframe: true,
      depthWrite: false,
    });

  const materials = [createMaterial(210, 0.68), createMaterial(150, 0.22)];
  const layers = materials.map((material, index) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = index === 0 ? 0 : -135;
    scene.add(mesh);
    return mesh;
  });

  let frameHandle: number | null = null;
  let running = false;
  let disposed = false;
  let failureReported = false;
  let elapsedTime = 0;
  let previousTimestamp: number | null = null;
  let onContextLost: (event: Event) => void;

  const disposeResources = (): void => {
    if (disposed) return;
    disposed = true;
    running = false;
    previousTimestamp = null;
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
    canvas.removeEventListener("webglcontextlost", onContextLost);
    renderer.debug.onShaderError = null;
    scene.remove(...layers);
    geometry.dispose();
    materials[0].dispose();
    materials[1].dispose();
    renderer.dispose();
  };

  const reportFailure = (error: unknown): void => {
    if (failureReported) return;
    failureReported = true;
    disposeResources();
    onFailure(error);
  };

  onContextLost = (event): void => {
    event.preventDefault();
    reportFailure(new Error("WebGL context lost"));
  };

  const applyTargets = (amount: number): void => {
    pointer.lerp(pointerTarget, amount);
    wireColor.lerp(wireTarget, amount);
    clearColor.lerp(clearTarget, amount);
    camera.position.x += (pointerTarget.x * 20 - camera.position.x) * amount;
    camera.position.y += (baseCameraY + pointerTarget.y * 14 - camera.position.y) * amount;
    renderer.setClearColor(clearColor, 1);
  };

  const renderAt = (time: number, damping: number): void => {
    applyTargets(damping);
    materials[0].uniforms.uTime.value = time;
    materials[1].uniforms.uTime.value = time;
    renderer.render(scene, camera);
  };

  const animate: FrameRequestCallback = (timestamp) => {
    frameHandle = null;
    if (!running || disposed) return;
    if (previousTimestamp !== null) {
      elapsedTime += Math.max(timestamp - previousTimestamp, 0) * 0.001;
    }
    previousTimestamp = timestamp;
    try {
      renderAt(elapsedTime, 0.035);
    } catch (error) {
      reportFailure(error);
      return;
    }
    if (running && !disposed) frameHandle = requestFrame(animate);
  };

  const controller: BackgroundController = {
    start(): void {
      if (running || disposed) return;
      running = true;
      previousTimestamp = null;
      frameHandle = requestFrame(animate);
    },
    stop(): void {
      running = false;
      previousTimestamp = null;
      if (frameHandle === null) return;
      cancelFrame(frameHandle);
      frameHandle = null;
    },
    resize(width: number, height: number, pixelRatio: number): void {
      const safeWidth = Math.max(width, 1);
      const safeHeight = Math.max(height, 1);
      renderer.setPixelRatio(capPixelRatio(pixelRatio));
      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
    },
    setPointer(x: number, y: number): void {
      pointerTarget.set(x, y);
    },
    setTheme(theme: SceneTheme): void {
      wireTarget.set(theme.wire);
      clearTarget.set(theme.background);
    },
    renderStatic(): void {
      if (disposed) return;
      try {
        renderAt(18, 1);
      } catch (error) {
        reportFailure(error);
      }
    },
    dispose(): void {
      disposeResources();
    },
  };

  canvas.addEventListener("webglcontextlost", onContextLost);
  renderer.debug.onShaderError = () => {
    reportFailure(new Error("Background shader compilation failed"));
  };

  try {
    renderer.compile(scene, camera);
    if (failureReported) throw new Error("Background shader compilation failed");
  } catch (error) {
    reportFailure(error);
    throw error;
  }

  return controller;
}
