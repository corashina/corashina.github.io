import * as THREE from "three";
import {
  createParticleField,
  lowerQuality,
  selectQualityTier,
  type ParticleBlendMode,
  type ParticleFieldController,
  type ParticlePalette,
  type QualityTier,
} from "./particleField";

export type SceneTheme = ParticlePalette & {
  background: THREE.ColorRepresentation;
  blendMode: ParticleBlendMode;
};

export type BackgroundController = {
  start(): void;
  stop(): void;
  resize(width: number, height: number, pixelRatio: number): void;
  setPointer(x: number, y: number, speed: number): void;
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
  createField?: typeof createParticleField;
  hardwareConcurrency?: number;
  onFailure?(error: unknown): void;
  staticQuality?: QualityTier;
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

export function normalizePointerSpeed(
  deltaX: number,
  deltaY: number,
  deltaMs: number,
  rect: DOMRect,
): number {
  if (deltaMs <= 0 || rect.width <= 0 || rect.height <= 0) return 0;
  const normalizedDistance = Math.hypot(deltaX / rect.width, deltaY / rect.height);
  return Math.min(normalizedDistance / (deltaMs / 1_000), 1);
}

const defaultDependencies: BackgroundSceneDependencies = {
  createRenderer: (canvas) =>
    new THREE.WebGLRenderer({
      antialias: true,
      canvas,
    }),
  requestFrame: (callback) => window.requestAnimationFrame(callback),
  cancelFrame: (handle) => window.cancelAnimationFrame(handle),
};

const SAMPLE_FRAMES = 90;
const SLOW_FRAME_MS = 22;
const REQUIRED_SLOW_FRAMES = 45;
const QUALITY_FADE_SECONDS = 0.4;
const MAX_SIMULATION_DELTA_MS = 50;
const INITIAL_FRAME_DELTA_SECONDS = 1 / 60;
const TARGET_DAMPING_RATE = -Math.log(1 - 0.035) * 60;
const THEME_DAMPING_RATE = -Math.log(1 - 0.99) / 0.22;
const QUALITY_MIX = { low: 0, medium: 1, high: 2 } as const;

export function createBackgroundScene(
  canvas: HTMLCanvasElement,
  options: BackgroundSceneOptions = {},
): BackgroundController {
  const createRenderer = options.createRenderer ?? defaultDependencies.createRenderer;
  const requestFrame = options.requestFrame ?? defaultDependencies.requestFrame;
  const cancelFrame = options.cancelFrame ?? defaultDependencies.cancelFrame;
  const createField = options.createField ?? createParticleField;
  const onFailure = options.onFailure ?? (() => undefined);
  const staticQuality = options.staticQuality;
  const hardwareConcurrency =
    options.hardwareConcurrency ??
    (typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = createRenderer(canvas);
  } catch (error) {
    onFailure(error);
    throw error;
  }
  let field: ParticleFieldController | undefined;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  try {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, 1, 1, 4000);
    camera.position.set(0, 0, 1050);
    field = createField("high");
    scene.add(field.group);
  } catch (error) {
    field?.dispose();
    renderer.dispose();
    onFailure(error);
    throw error;
  }
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  let pointerSpeed = 0;
  let pointerSpeedTarget = 0;
  const particleColor = new THREE.Color("#aeb4ba");
  const particleTarget = particleColor.clone();
  const signalColor = new THREE.Color("#f4f6f7");
  const signalTarget = signalColor.clone();
  const connectionColor = new THREE.Color("#697078");
  const connectionTarget = connectionColor.clone();
  const clearColor = new THREE.Color("#222222");
  const clearTarget = clearColor.clone();

  let frameHandle: number | null = null;
  let running = false;
  let disposed = false;
  let failureReported = false;
  let elapsedTime = 0;
  let previousTimestamp: number | null = null;
  let onContextLost: (event: Event) => void;
  let qualityTier: QualityTier = "high";
  let qualityInitialized = false;
  let warmupFrames = 0;
  let sampleFrames = 0;
  let slowFrames = 0;
  let performanceLocked = false;
  let qualityTransition: { from: number; to: QualityTier; elapsed: number } | null = null;
  let pendingQualityTier: QualityTier | null = null;

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
    scene.remove(field.group);
    field.dispose();
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

  const applyTargets = (pointerAmount: number, themeAmount: number): void => {
    pointer.lerp(pointerTarget, pointerAmount);
    pointerSpeed += (pointerSpeedTarget - pointerSpeed) * pointerAmount;
    particleColor.lerp(particleTarget, themeAmount);
    signalColor.lerp(signalTarget, themeAmount);
    connectionColor.lerp(connectionTarget, themeAmount);
    clearColor.lerp(clearTarget, themeAmount);
    field.setPointer(pointer.x * 900, pointer.y * 520, pointerSpeed);
    field.setColors({
      particle: particleColor,
      signal: signalColor,
      connection: connectionColor,
    });
    renderer.setClearColor(clearColor, 1);
  };

  const beginQualityTransition = (to: QualityTier): void => {
    if (QUALITY_MIX[to] >= QUALITY_MIX[qualityTier]) return;
    if (qualityTransition) {
      if (
        QUALITY_MIX[to] < QUALITY_MIX[qualityTransition.to] &&
        (!pendingQualityTier || QUALITY_MIX[to] < QUALITY_MIX[pendingQualityTier])
      ) {
        pendingQualityTier = to;
      }
      return;
    }
    qualityTransition = { from: QUALITY_MIX[qualityTier], to, elapsed: 0 };
  };

  const applyLowestQualityImmediately = (requestedTier?: QualityTier): void => {
    const candidates = [
      qualityTier,
      qualityTransition?.to,
      pendingQualityTier,
      requestedTier,
    ].filter((tier): tier is QualityTier => tier !== null && tier !== undefined);
    qualityTier = candidates.reduce((lowest, tier) =>
      QUALITY_MIX[tier] < QUALITY_MIX[lowest] ? tier : lowest,
    );
    qualityTransition = null;
    pendingQualityTier = null;
    field.setQuality(qualityTier);
    field.setQualityMix(QUALITY_MIX[qualityTier]);
  };

  const samplePerformance = (deltaMs: number): void => {
    if (!qualityInitialized || performanceLocked || qualityTransition) return;
    if (warmupFrames < 30) {
      warmupFrames += 1;
      return;
    }
    sampleFrames += 1;
    if (deltaMs > SLOW_FRAME_MS) slowFrames += 1;
    if (sampleFrames < SAMPLE_FRAMES) return;
    if (slowFrames >= REQUIRED_SLOW_FRAMES && qualityTier !== "low") {
      performanceLocked = true;
      beginQualityTransition(lowerQuality(qualityTier));
    }
    sampleFrames = 0;
    slowFrames = 0;
  };

  const updateQualityTransition = (deltaSeconds: number): void => {
    if (!qualityTransition) return;
    qualityTransition.elapsed += deltaSeconds;
    const progress = Math.min(qualityTransition.elapsed / QUALITY_FADE_SECONDS, 1);
    const targetMix = QUALITY_MIX[qualityTransition.to];
    field.setQualityMix(
      THREE.MathUtils.lerp(qualityTransition.from, targetMix, progress),
    );
    if (progress < 1) return;
    qualityTier = qualityTransition.to;
    field.setQuality(qualityTier);
    qualityTransition = null;
    const pendingTier = pendingQualityTier;
    pendingQualityTier = null;
    if (pendingTier) beginQualityTransition(pendingTier);
  };

  const animate: FrameRequestCallback = (timestamp) => {
    frameHandle = null;
    if (!running || disposed) return;
    const deltaMs =
      previousTimestamp === null ? 0 : Math.max(timestamp - previousTimestamp, 0);
    const simulationDeltaMs = Math.min(deltaMs, MAX_SIMULATION_DELTA_MS);
    const dampingDeltaSeconds =
      previousTimestamp === null
        ? INITIAL_FRAME_DELTA_SECONDS
        : simulationDeltaMs * 0.001;
    elapsedTime += simulationDeltaMs * 0.001;
    previousTimestamp = timestamp;
    samplePerformance(deltaMs);
    updateQualityTransition(simulationDeltaMs * 0.001);
    pointerSpeedTarget *= Math.exp(-simulationDeltaMs * 0.001 * 3.2);
    try {
      applyTargets(
        1 - Math.exp(-TARGET_DAMPING_RATE * dampingDeltaSeconds),
        1 - Math.exp(-THEME_DAMPING_RATE * dampingDeltaSeconds),
      );
      field.setTime(elapsedTime);
      renderer.render(scene, camera);
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
      const safePixelRatio = capPixelRatio(pixelRatio);
      renderer.setPixelRatio(safePixelRatio);
      renderer.setSize(safeWidth, safeHeight, false);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
      field.setContentMask(
        0.5,
        0.5,
        Math.min(0.28, 300 / safeWidth),
        Math.min(0.42, 420 / safeHeight),
      );

      const selectedTier = selectQualityTier(
        safeWidth,
        safeHeight,
        safePixelRatio,
        hardwareConcurrency,
      );
      if (!qualityInitialized) {
        qualityTier = selectedTier;
        qualityInitialized = true;
        field.setQuality(qualityTier);
        field.setQualityMix(QUALITY_MIX[qualityTier]);
      } else if (QUALITY_MIX[selectedTier] < QUALITY_MIX[qualityTier]) {
        if (running) beginQualityTransition(selectedTier);
        else applyLowestQualityImmediately(selectedTier);
      }
    },
    setPointer(x: number, y: number, speed: number): void {
      pointerTarget.set(x, y);
      pointerSpeedTarget = Math.min(Math.max(speed, 0), 1);
    },
    setTheme(theme: SceneTheme): void {
      particleTarget.set(theme.particle);
      signalTarget.set(theme.signal);
      connectionTarget.set(theme.connection);
      clearTarget.set(theme.background);
      field.setBlendMode(theme.blendMode);
    },
    renderStatic(): void {
      if (disposed) return;
      if (staticQuality) {
        qualityTier = staticQuality;
        qualityTransition = null;
        pendingQualityTier = null;
        field.setQuality(staticQuality);
        field.setQualityMix(QUALITY_MIX[staticQuality]);
      } else {
        applyLowestQualityImmediately();
      }
      pointer.set(0, 0);
      pointerTarget.set(0, 0);
      pointerSpeed = 0;
      pointerSpeedTarget = 0;
      try {
        applyTargets(1, 1);
        field.setTime(18);
        renderer.render(scene, camera);
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
