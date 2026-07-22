import * as THREE from "three";
import { CameraController } from "../interaction/CameraController";
import { InteractionController } from "../interaction/InteractionController";
import { MAX_PIXEL_RATIO } from "../particles/particleConfig";
import { ParticleSimulation } from "../particles/ParticleSimulation";
import { RenderPipeline } from "../rendering/RenderPipeline";
import { FixedStepClock } from "../runtime/FixedStepClock";
import {
  DEFAULT_SCENE_PARAMETERS,
  normalizeSceneParameters,
  type SceneParameters,
} from "../runtime/SceneParameters";
import { FpsCounter, type FpsSampler } from "../ui/FpsCounter";
import type { CapabilityReport } from "./capabilities";
import type { FrameContext, InteractionSnapshot } from "./contracts";

const STEP_SECONDS = 1 / 60;
const RESIZE_SETTLE_MS = 100;
const CAMERA_BOUNDS = { radius: [5.5, 13] as const, polarAngle: [0.45, 1.35] as const };
const EMPTY_INTERACTION: InteractionSnapshot = {
  pointerNdc: [0, 0], pointerWorld: [0, 0, 0], pointerVelocity: [0, 0], gravity: 0,
  orbitDelta: [0, 0], zoomDelta: 0, pulseId: 0, pulseCharge: 0, pulseEnergy: 0, pulseAge: 3, pulseRadius: 0, release: false,
  resetRequested: false, reducedMotion: false,
};

type Disposable = { dispose(): void };
type Renderer = Disposable & {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
};
type Scene = { add(...objects: unknown[]): void; remove(...objects: unknown[]): void };
type Camera = { aspect: number; updateProjectionMatrix(): void };
type ParticleSystem = Disposable & { object: unknown; update(frame: FrameContext): void; setParameters(parameters: SceneParameters): void };
type Pipeline = Disposable & {
  render(frame: Pick<FrameContext, "deltaSeconds">): void;
  resize(width: number, height: number, dpr: number): void;
  setBloomStrength(strength: number): void;
};
type Clock = { advance(nowMs: number, step: () => void): number; pause(): void; resume(nowMs: number): void };
type CameraControls = { projectPointer(pointer: readonly [number, number]): readonly [number, number, number]; update(frame: FrameContext): void; dispose?: () => void };
type InteractionControls = Disposable & { sample(deltaSeconds: number): InteractionSnapshot };

export type ShowcaseAppFactories = {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  createRenderer: (canvas: HTMLCanvasElement) => Renderer;
  createScene: () => Scene;
  createCamera: (aspect: number) => Camera;
  createInteractionController: (input: { canvas: HTMLCanvasElement; reducedMotion: boolean }) => InteractionControls;
  createCameraController: (input: { camera: Camera; reducedMotion: boolean }) => CameraControls;
  createClock: () => Clock;
  createFpsCounter: (publish: (fps: number) => void) => FpsSampler;
  createParticles: (renderer: Renderer) => ParticleSystem;
  createPipeline: (input: { renderer: Renderer; scene: Scene; camera: Camera; particles: ParticleSystem }) => Pipeline;
};

export type ShowcaseAppOptions = {
  canvas: HTMLCanvasElement;
  root?: HTMLElement;
  capabilities: CapabilityReport;
  /** Limited browser-test instrumentation. Never enable from production UI. */
  testMode?: boolean;
  factories?: Partial<ShowcaseAppFactories>;
  onStateChange?: (state: "loading" | "ready" | "recovering" | "fallback", message?: string) => void;
  onFirstFrame?: () => void;
  onFps?: (fps: number) => void;
};

type GpuSystems = { particles: ParticleSystem; pipeline: Pipeline };

const productionFactories: ShowcaseAppFactories = {
  now: () => performance.now(),
  requestFrame: (callback) => requestAnimationFrame(callback),
  cancelFrame: (id) => cancelAnimationFrame(id),
  createRenderer: (canvas) => {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.shadowMap.enabled = false;
    return renderer;
  },
  createScene: () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050d);
    return scene;
  },
  createCamera: (aspect) => new THREE.PerspectiveCamera(45, aspect, 0.1, 100),
  createInteractionController: ({ canvas, reducedMotion }) => new InteractionController({ canvas, eventTarget: window, reducedMotion }),
  createCameraController: ({ camera, reducedMotion }) => new CameraController(camera as THREE.PerspectiveCamera, CAMERA_BOUNDS, reducedMotion),
  createClock: () => new FixedStepClock(STEP_SECONDS),
  createFpsCounter: (publish) => new FpsCounter(publish),
  createParticles: (renderer) => new ParticleSimulation(renderer as THREE.WebGLRenderer),
  createPipeline: ({ renderer, scene, camera }) => new RenderPipeline({
    renderer: renderer as THREE.WebGLRenderer,
    scene: scene as THREE.Scene,
    camera: camera as unknown as THREE.Camera,
  }),
};

/** Owns the particle scene, frame loop, WebGL recovery, and browser lifecycle. */
export class ShowcaseApp {
  private readonly root: HTMLElement;
  private readonly factories: ShowcaseAppFactories;
  private readonly renderer: Renderer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly interactionController: InteractionControls;
  private readonly cameraController: CameraControls;
  private readonly clock: Clock;
  private readonly fpsCounter: FpsSampler;
  private systems: GpuSystems;
  private parameters: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS };
  private rafId: number | null = null;
  private running = false;
  private desiredRunning = false;
  private disposed = false;
  private recovering = false;
  private contextLosses = 0;
  private elapsedSeconds = 0;
  private lastFrameNowMs: number | null = null;
  private frame: FrameContext;
  private firstFrame = true;
  private readonly cleanups = new Set<() => void>();
  private readonly testMode: boolean;
  private renderedFrames = 0;
  private resizeTimer: number | null = null;
  private compiled = false;
  private compiling = false;
  private compileGeneration = 0;

  constructor(private readonly options: ShowcaseAppOptions) {
    try {
      this.root = options.root ?? document.documentElement;
      this.testMode = options.testMode === true;
      this.factories = { ...productionFactories, ...options.factories };
      this.renderer = this.factories.createRenderer(options.canvas);
      this.scene = this.factories.createScene();
      this.camera = this.factories.createCamera(this.viewport().width / this.viewport().height);
      this.interactionController = this.factories.createInteractionController({ canvas: options.canvas, reducedMotion: options.capabilities.reducedMotion });
      this.cameraController = this.factories.createCameraController({ camera: this.camera, reducedMotion: options.capabilities.reducedMotion });
      this.clock = this.factories.createClock();
      this.fpsCounter = this.factories.createFpsCounter(options.onFps ?? (() => undefined));
      this.systems = this.createGpuSystems();
      this.applyParameters();
      this.setTestLayersReady();
      this.frame = { deltaSeconds: 0, elapsedSeconds: 0, interaction: { ...EMPTY_INTERACTION, reducedMotion: options.capabilities.reducedMotion } };
      this.resize();
      options.canvas.addEventListener("webglcontextlost", this.onContextLost);
      options.canvas.addEventListener("webglcontextrestored", this.onContextRestored);
      window.addEventListener("resize", this.onResize);
      document.addEventListener("visibilitychange", this.onVisibilityChange);
    } catch (error) {
      this.disposePartiallyConstructed();
      throw error;
    }
  }

  start(): void {
    if (this.disposed) return;
    this.desiredRunning = true;
    if (this.running || this.recovering || document.hidden) return;
    if (!this.compiled) { this.compileScene(); return; }
    this.beginFrameLoop();
  }

  stop(): void {
    this.desiredRunning = false;
    this.pauseFrameLoop();
  }

  registerCleanup(cleanup: () => void): void {
    if (this.disposed) { cleanup(); return; }
    this.cleanups.add(cleanup);
  }

  resetView(): void {
    if (this.disposed) return;
    const resettable = this.cameraController as CameraControls & { reset?: () => void };
    if (resettable.reset !== undefined) { resettable.reset(); return; }
    this.cameraController.update({ ...this.frame, interaction: { ...this.frame.interaction, resetRequested: true } });
  }

  setSceneParameters(parameters: SceneParameters): void {
    if (this.disposed) return;
    this.parameters = normalizeSceneParameters(parameters, this.parameters);
    this.applyParameters();
    if (this.testMode) this.root.dataset.sceneSpeed = String(this.parameters.speed);
  }

  isDisposed(): boolean { return this.disposed; }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.compileGeneration += 1;
    this.compiling = false;
    this.options.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.options.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.cancelPendingResize();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
    this.disposeGpuSystems();
    this.fpsCounter.dispose();
    this.cameraController.dispose?.();
    this.interactionController.dispose();
    this.renderer.dispose();
    this.clearTestTelemetry();
  }

  private beginFrameLoop(): void {
    if (this.running || this.disposed || this.recovering || !this.desiredRunning || document.hidden) return;
    this.running = true;
    this.lastFrameNowMs = this.factories.now();
    this.scheduleFrame();
  }

  private compileScene(): void {
    if (this.compiling || this.disposed || this.recovering) return;
    const compileAsync = (this.renderer as Renderer & { compileAsync?: (scene: Scene, camera: Camera) => Promise<unknown> }).compileAsync;
    if (compileAsync === undefined) { this.compiled = true; this.beginFrameLoop(); return; }
    this.compiling = true;
    const generation = ++this.compileGeneration;
    let compilation: Promise<unknown>;
    try { compilation = compileAsync.call(this.renderer, this.scene, this.camera); }
    catch (error) { this.compiling = false; this.showFallback(error instanceof Error ? error.message : "Shader compilation failed."); return; }
    void compilation.then(() => {
      if (generation !== this.compileGeneration || this.disposed || this.recovering) return;
      this.compiling = false;
      this.compiled = true;
      this.beginFrameLoop();
    }, (error: unknown) => {
      if (generation !== this.compileGeneration || this.disposed || this.recovering) return;
      this.compiling = false;
      this.showFallback(error instanceof Error ? error.message : "Shader compilation failed.");
    });
  }

  private pauseFrameLoop(): void {
    this.running = false;
    if (this.rafId !== null) this.factories.cancelFrame(this.rafId);
    this.rafId = null;
  }

  private createGpuSystems(): GpuSystems {
    let particles: ParticleSystem | undefined;
    let pipeline: Pipeline | undefined;
    try {
      particles = this.factories.createParticles(this.renderer);
      this.scene.add(particles.object);
      pipeline = this.factories.createPipeline({ renderer: this.renderer, scene: this.scene, camera: this.camera, particles });
      return { particles, pipeline };
    } catch (error) {
      pipeline?.dispose();
      particles?.dispose();
      if (particles !== undefined) this.scene.remove(particles.object);
      throw error;
    }
  }

  private disposeGpuSystems(): void {
    const { particles, pipeline } = this.systems;
    pipeline.dispose();
    particles.dispose();
    this.scene.remove(particles.object);
  }

  private disposePartiallyConstructed(): void {
    const partial = this as unknown as { systems?: GpuSystems; scene?: Scene; fpsCounter?: FpsSampler; cameraController?: CameraControls; interactionController?: InteractionControls; renderer?: Renderer };
    if (partial.systems !== undefined) {
      partial.systems.pipeline.dispose();
      partial.systems.particles.dispose();
      partial.scene?.remove(partial.systems.particles.object);
    }
    partial.fpsCounter?.dispose();
    partial.cameraController?.dispose?.();
    partial.interactionController?.dispose();
    partial.renderer?.dispose();
  }

  private scheduleFrame(): void {
    if (this.running && !this.disposed && this.rafId === null) this.rafId = this.factories.requestFrame(this.onFrame);
  }

  private readonly onFrame = (nowMs: number): void => {
    this.rafId = null;
    if (!this.running || this.disposed || this.recovering) return;
    try {
      this.lastFrameNowMs = nowMs;
      this.clock.advance(nowMs, () => this.step());
      this.systems.pipeline.render(this.frame);
      this.fpsCounter.sample(nowMs);
      this.recordTestFrame();
      if (this.firstFrame) {
        this.firstFrame = false;
        if (this.testMode) this.root.dataset.showcaseReady = "true";
        this.setState("ready");
        this.options.onFirstFrame?.();
      }
      this.scheduleFrame();
    } catch (error) {
      this.showFallback(error instanceof Error ? error.message : "The interactive scene could not be rendered.");
    }
  };

  private step(): void {
    const sampled = this.interactionController.sample(STEP_SECONDS);
    const interaction: InteractionSnapshot = { ...sampled, pointerWorld: this.cameraController.projectPointer(sampled.pointerNdc) };
    this.elapsedSeconds += STEP_SECONDS;
    const frame: FrameContext = { deltaSeconds: STEP_SECONDS, elapsedSeconds: this.elapsedSeconds, interaction };
    this.systems.particles.update(frame);
    this.cameraController.update(frame);
    this.frame = frame;
    if (this.testMode) {
      this.root.dataset.lastPulse = String(interaction.pulseId);
      if (interaction.resetRequested) this.root.dataset.lastReset = "1";
      if (interaction.orbitDelta[0] !== 0 || interaction.orbitDelta[1] !== 0) this.root.dataset.lastOrbit = "true";
      if (interaction.zoomDelta !== 0) this.root.dataset.lastZoom = "true";
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.hidden) { this.clock.pause(); this.fpsCounter.reset(); this.pauseFrameLoop(); return; }
    this.clock.resume(this.factories.now());
    this.lastFrameNowMs = this.factories.now();
    if (this.desiredRunning) this.start();
  };

  private readonly onResize = (): void => {
    if (this.disposed) return;
    this.cancelPendingResize();
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null;
      if (this.disposed || this.recovering || this.options.canvas.clientWidth <= 0 || this.options.canvas.clientHeight <= 0) return;
      try { this.resize(); }
      catch (error) { this.showFallback(error instanceof Error ? error.message : "Resize allocation failed."); }
    }, RESIZE_SETTLE_MS);
  };

  private cancelPendingResize(): void {
    if (this.resizeTimer === null) return;
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = null;
  }

  private resize(): void {
    if (this.disposed) return;
    const { width, height, dpr } = this.viewport();
    const effectiveDpr = Math.min(dpr, MAX_PIXEL_RATIO);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(effectiveDpr);
    this.renderer.setSize(width, height, false);
    this.systems?.pipeline.resize(width, height, effectiveDpr);
  }

  private viewport(): { width: number; height: number; dpr: number } {
    return {
      width: Math.max(1, this.options.canvas.clientWidth),
      height: Math.max(1, this.options.canvas.clientHeight),
      dpr: Math.max(1, window.devicePixelRatio || 1),
    };
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.cancelPendingResize();
    this.contextLosses += 1;
    if (this.contextLosses > 1) { this.showFallback("WebGL context was lost more than once."); return; }
    this.recovering = true;
    this.compileGeneration += 1;
    this.compiling = false;
    this.compiled = false;
    this.fpsCounter.reset();
    this.pauseFrameLoop();
    this.firstFrame = true;
    if (this.testMode) delete this.root.dataset.showcaseReady;
    this.setState("recovering");
  };

  private readonly onContextRestored = (): void => {
    if (this.disposed || !this.recovering) return;
    try {
      this.disposeGpuSystems();
      this.systems = this.createGpuSystems();
      this.applyParameters();
      this.resize();
      this.recovering = false;
      this.compiled = false;
      this.setState("loading");
      if (this.desiredRunning) this.start();
    } catch (error) {
      this.showFallback(error instanceof Error ? error.message : "WebGL recovery failed.");
    }
  };

  private setState(state: "loading" | "ready" | "recovering" | "fallback", message?: string): void {
    this.root.dataset.showcaseState = state;
    if (message === undefined) delete this.root.dataset.showcaseError;
    else this.root.dataset.showcaseError = message;
    this.options.onStateChange?.(state, message);
  }

  private setTestLayersReady(): void {
    if (!this.testMode) return;
    this.root.dataset.showcaseLayers = "1";
    this.root.dataset.reducedMotion = String(this.options.capabilities.reducedMotion);
    this.root.dataset.sceneSpeed = String(this.parameters.speed);
  }

  private recordTestFrame(): void {
    if (this.testMode) this.root.dataset.renderedFrames = String(++this.renderedFrames);
  }

  private clearTestTelemetry(): void {
    if (!this.testMode) return;
    for (const key of ["showcaseReady", "lastPulse", "lastReset", "reducedMotion", "showcaseLayers", "renderedFrames", "lastOrbit", "lastZoom", "sceneSpeed"] as const) {
      delete this.root.dataset[key];
    }
  }

  private applyParameters(): void {
    this.systems.particles.setParameters(this.parameters);
    this.systems.pipeline.setBloomStrength(this.parameters.bloomStrength);
  }

  private showFallback(message: string): void {
    if (this.disposed) return;
    this.setState("fallback", message);
    this.dispose();
  }
}
