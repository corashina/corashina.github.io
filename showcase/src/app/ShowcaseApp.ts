import * as THREE from "three";
import type { CapabilityReport } from "./capabilities";
import type { FrameContext, InteractionSnapshot } from "./contracts";
import { ProtoStar } from "../core/ProtoStar";
import { CameraController } from "../interaction/CameraController";
import { InteractionController } from "../interaction/InteractionController";
import { SpaceMembrane } from "../membrane/SpaceMembrane";
import { ParticleSimulation } from "../particles/ParticleSimulation";
import { QualityManager } from "../quality/QualityManager";
import { selectInitialTier, type QualityMode, type QualityProfile, type QualityTier } from "../quality/qualityProfiles";
import { RenderPipeline } from "../rendering/RenderPipeline";
import { FixedStepClock } from "../runtime/FixedStepClock";
import { NebulaPass } from "../volume/NebulaPass";

const STEP_SECONDS = 1 / 60;
const RESIZE_SETTLE_MS = 100;
const CAMERA_BOUNDS = { radius: [5.5, 13] as const, polarAngle: [0.45, 1.35] as const };
const EMPTY_INTERACTION: InteractionSnapshot = {
  pointerNdc: [0, 0], pointerWorld: [0, 0, 0], pointerVelocity: [0, 0], gravity: 0,
  orbitDelta: [0, 0], zoomDelta: 0, pulseId: 0, pulseCharge: 0, pulseEnergy: 0, pulseAge: 3, pulseRadius: 0, release: false,
  resetRequested: false, reducedMotion: false,
};

type Disposable = { dispose(): void };
type QualitySystem = Disposable & { setQuality(profile: QualityProfile): void };
type Renderer = Disposable & {
  setSize(width: number, height: number, updateStyle?: boolean): void;
  setPixelRatio(ratio: number): void;
};
type Scene = { add(...objects: unknown[]): void; remove(...objects: unknown[]): void };
type Camera = { aspect: number; updateProjectionMatrix(): void };
type ParticleSystem = QualitySystem & { object: unknown; update(frame: FrameContext): void; getPositionTexture(): unknown };
type ProtoSystem = QualitySystem & { object: unknown; update(frame: FrameContext): void; getShadowMaterials(): THREE.Material[] };
type MembraneSystem = QualitySystem & { object: unknown; update(frame: FrameContext, particleTexture: unknown): void; getShadowMaterials(): THREE.Material[] };
type NebulaSystem = QualitySystem & { setInteraction(interaction: InteractionSnapshot): void; setElapsedTime(elapsedSeconds: number): void };
type Pipeline = QualitySystem & { render(frame: Pick<FrameContext, "deltaSeconds">): void; resize(width: number, height: number, dpr: number): void };
type Clock = { advance(nowMs: number, step: () => void): number; pause(): void; resume(nowMs: number): void };
type QualityController = { setMode(mode: QualityMode): QualityTier; getProfile(): QualityProfile; sample(frameMs: number, nowMs: number): QualityTier | null; getTransition(nowMs: number): unknown };
type CameraControls = { projectPointer(pointer: readonly [number, number]): readonly [number, number, number]; update(frame: FrameContext): void; dispose?: () => void };
type InteractionControls = Disposable & { sample(deltaSeconds: number): InteractionSnapshot };

export type ShowcaseAppFactories = {
  now: () => number;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
  createRenderer: (canvas: HTMLCanvasElement) => Renderer;
  createScene: () => Scene;
  createCamera: (aspect: number) => Camera;
  createLights: (scene: Scene) => void;
  createInteractionController: (input: { canvas: HTMLCanvasElement; reducedMotion: boolean }) => InteractionControls;
  createCameraController: (input: { camera: Camera; reducedMotion: boolean }) => CameraControls;
  createClock: () => Clock;
  createQualityManager: (tier: QualityTier) => QualityController;
  createParticles: (renderer: Renderer, profile: QualityProfile) => ParticleSystem;
  createProtoStar: (profile: QualityProfile) => ProtoSystem;
  createMembrane: (renderer: Renderer, profile: QualityProfile) => MembraneSystem;
  createNebula: (profile: QualityProfile) => NebulaSystem;
  createPipeline: (input: { renderer: Renderer; scene: Scene; camera: Camera; particles: ParticleSystem; protoStar: ProtoSystem; membrane: MembraneSystem; nebula: NebulaSystem; profile: QualityProfile }) => Pipeline;
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
};

type GpuSystems = { particles: ParticleSystem; protoStar: ProtoSystem; membrane: MembraneSystem; nebula: NebulaSystem; pipeline: Pipeline };

function initialTier(capabilities: CapabilityReport): QualityTier {
  const viewportPixels = Math.max(1, window.innerWidth * window.innerHeight);
  return selectInitialTier({
    reducedMotion: capabilities.reducedMotion,
    viewportPixels,
    devicePixelRatio: Math.max(1, window.devicePixelRatio || 1),
    hardwareConcurrency: navigator.hardwareConcurrency || 4,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    touch: navigator.maxTouchPoints > 0,
  });
}

function setPosition(object: unknown, x: number, y: number, z: number): void {
  const positioned = object as { position?: { set?: (x: number, y: number, z: number) => void } };
  positioned.position?.set?.(x, y, z);
}

const productionFactories: ShowcaseAppFactories = {
  now: () => performance.now(), requestFrame: (callback) => requestAnimationFrame(callback), cancelFrame: (id) => cancelAnimationFrame(id),
  createRenderer: (canvas) => {
    const capture = new URLSearchParams(window.location.search).get("capture") === "1";
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: capture });
    renderer.shadowMap.enabled = true;
    return renderer;
  },
  createScene: () => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x03050d); return scene;
  },
  createCamera: (aspect) => new THREE.PerspectiveCamera(45, aspect, 0.1, 100),
  createLights: (scene) => {
    const target = scene as THREE.Scene;
    const key = new THREE.DirectionalLight(0xffbd78, 2.4); key.position.set(4, 7, 5); key.castShadow = true;
    const rim = new THREE.PointLight(0x58e8ff, 3, 20); rim.position.set(-5, 3, -4);
    const fill = new THREE.HemisphereLight(0x8c63ff, 0x06020f, 0.55);
    target.add(key, rim, fill);
  },
  createInteractionController: ({ canvas, reducedMotion }) => new InteractionController({ canvas, eventTarget: window, reducedMotion }),
  createCameraController: ({ camera, reducedMotion }) => new CameraController(camera as THREE.PerspectiveCamera, CAMERA_BOUNDS, reducedMotion),
  createClock: () => new FixedStepClock(STEP_SECONDS),
  createQualityManager: (tier) => new QualityManager(tier),
  createParticles: (renderer, profile) => new ParticleSimulation(renderer as THREE.WebGLRenderer, profile),
  createProtoStar: (profile) => new ProtoStar(profile),
  createMembrane: (renderer, profile) => new SpaceMembrane(renderer as THREE.WebGLRenderer, profile),
  createNebula: (profile) => new NebulaPass(profile),
  createPipeline: ({ renderer, scene, camera, protoStar, membrane, nebula, profile }) => new RenderPipeline({
    renderer: renderer as THREE.WebGLRenderer, scene: scene as THREE.Scene, camera: camera as unknown as THREE.Camera,
    protoStar: protoStar as unknown as ProtoStar, membrane: membrane as unknown as SpaceMembrane, nebulaPass: nebula as unknown as NebulaPass, profile,
  }),
};

/** Owns the scene graph, frame loop, WebGL recovery, and browser lifecycle. */
export class ShowcaseApp {
  private readonly root: HTMLElement;
  private readonly factories: ShowcaseAppFactories;
  private readonly renderer: Renderer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly interactionController: InteractionControls;
  private readonly cameraController: CameraControls;
  private readonly clock: Clock;
  private readonly qualityManager: QualityController;
  private systems: GpuSystems;
  private profile: QualityProfile;
  private rafId: number | null = null;
  private running = false;
  private desiredRunning = false;
  private disposed = false;
  private recovering = false;
  private contextLosses = 0;
  private elapsedSeconds = 0;
  private lastFrameNowMs: number | null = null;
  private frame: FrameContext;
  private qualityTransition: unknown = null;
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
      this.factories.createLights(this.scene);
      this.interactionController = this.factories.createInteractionController({ canvas: options.canvas, reducedMotion: options.capabilities.reducedMotion });
      this.cameraController = this.factories.createCameraController({ camera: this.camera, reducedMotion: options.capabilities.reducedMotion });
      this.clock = this.factories.createClock();
      const tier = initialTier(options.capabilities);
      this.qualityManager = this.factories.createQualityManager(tier);
      this.profile = this.qualityManager.getProfile();
      this.setTestQualityTier(tier);
      this.systems = this.createGpuSystems(this.profile);
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
      this.compiling = false; this.compiled = true; this.beginFrameLoop();
    }, (error: unknown) => {
      if (generation !== this.compileGeneration || this.disposed || this.recovering) return;
      this.compiling = false;
      this.showFallback(error instanceof Error ? error.message : "Shader compilation failed.");
    });
  }

  stop(): void {
    this.desiredRunning = false;
    this.pauseFrameLoop();
  }

  /** Registers page-shell cleanup with the app lifecycle. */
  registerCleanup(cleanup: () => void): void {
    if (this.disposed) { cleanup(); return; }
    this.cleanups.add(cleanup);
  }

  private pauseFrameLoop(): void {
    this.running = false;
    if (this.rafId !== null) this.factories.cancelFrame(this.rafId);
    this.rafId = null;
  }

  setQualityMode(mode: QualityMode): void {
    if (this.disposed) return;
    const tier = this.qualityManager.setMode(mode);
    this.applyQuality(this.qualityManager.getProfile());
    this.setTestQualityTier(tier);
  }

  resetView(): void {
    if (this.disposed) return;
    const resettable = this.cameraController as CameraControls & { reset?: () => void };
    if (resettable.reset !== undefined) { resettable.reset(); return; }
    this.cameraController.update({ ...this.frame, interaction: { ...this.frame.interaction, resetRequested: true } });
  }

  getQualityTransition(): unknown { return this.qualityTransition; }
  isDisposed(): boolean { return this.disposed; }

  dispose(): void {
    if (this.disposed) return;
    this.stop(); this.disposed = true;
    this.compileGeneration += 1; this.compiling = false;
    this.options.canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.options.canvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    window.removeEventListener("resize", this.onResize);
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.cancelPendingResize();
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
    this.disposeGpuSystems();
    this.cameraController.dispose?.(); this.interactionController.dispose(); this.renderer.dispose();
    this.clearTestTelemetry();
  }

  private createGpuSystems(profile: QualityProfile): GpuSystems {
    let particles: ParticleSystem | undefined;
    let protoStar: ProtoSystem | undefined;
    let membrane: MembraneSystem | undefined;
    let nebula: NebulaSystem | undefined;
    let pipeline: Pipeline | undefined;
    try {
      particles = this.factories.createParticles(this.renderer, profile);
      protoStar = this.factories.createProtoStar(profile);
      membrane = this.factories.createMembrane(this.renderer, profile);
      nebula = this.factories.createNebula(profile);
      setPosition(protoStar.object, 0, 1.1, 0); setPosition(membrane.object, 0, -2.2, 0);
      this.scene.add(particles.object, protoStar.object, membrane.object);
      pipeline = this.factories.createPipeline({ renderer: this.renderer, scene: this.scene, camera: this.camera, particles, protoStar, membrane, nebula, profile });
      return { particles, protoStar, membrane, nebula, pipeline };
    } catch (error) {
      pipeline?.dispose(); nebula?.dispose(); membrane?.dispose(); protoStar?.dispose(); particles?.dispose();
      if (particles !== undefined) this.scene.remove(particles.object);
      if (protoStar !== undefined) this.scene.remove(protoStar.object);
      if (membrane !== undefined) this.scene.remove(membrane.object);
      throw error;
    }
  }

  private disposeGpuSystems(): void {
    const { particles, protoStar, membrane, nebula, pipeline } = this.systems;
    pipeline.dispose(); nebula.dispose(); membrane.dispose(); protoStar.dispose(); particles.dispose();
    this.scene.remove(particles.object, protoStar.object, membrane.object);
  }

  private disposePartiallyConstructed(): void {
    const partial = this as unknown as { systems?: GpuSystems; scene?: Scene; cameraController?: CameraControls; interactionController?: InteractionControls; renderer?: Renderer };
    if (partial.systems !== undefined) {
      const { particles, protoStar, membrane, nebula, pipeline } = partial.systems;
      pipeline.dispose(); nebula.dispose(); membrane.dispose(); protoStar.dispose(); particles.dispose();
      partial.scene?.remove(particles.object, protoStar.object, membrane.object);
    }
    partial.cameraController?.dispose?.(); partial.interactionController?.dispose(); partial.renderer?.dispose();
  }

  private scheduleFrame(): void {
    if (this.running && !this.disposed && this.rafId === null) this.rafId = this.factories.requestFrame(this.onFrame);
  }

  private readonly onFrame = (nowMs: number): void => {
    this.rafId = null;
    if (!this.running || this.disposed || this.recovering) return;
    try {
      const previous = this.lastFrameNowMs ?? nowMs;
      const frameMs = Math.max(0, nowMs - previous);
      this.lastFrameNowMs = nowMs;
      this.clock.advance(nowMs, () => this.step());
      const sampledTier = this.qualityManager.sample(frameMs, nowMs);
      if (sampledTier !== null) {
        this.applyQuality(this.qualityManager.getProfile());
        this.setTestQualityTier(sampledTier);
      }
      this.qualityTransition = this.qualityManager.getTransition(nowMs);
      this.systems.pipeline.render(this.frame);
      this.recordTestFrame();
      if (this.firstFrame) {
        this.firstFrame = false;
        if (this.testMode) this.root.dataset.showcaseReady = "true";
        this.setState("ready"); this.options.onFirstFrame?.();
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
    this.systems.protoStar.update(frame);
    this.systems.membrane.update(frame, this.systems.particles.getPositionTexture());
    this.systems.nebula.setInteraction(interaction);
    this.systems.nebula.setElapsedTime(this.elapsedSeconds);
    this.cameraController.update(frame);
    this.frame = frame;
    if (this.testMode) {
      this.root.dataset.lastPulse = String(interaction.pulseId);
      if (interaction.resetRequested) this.root.dataset.lastReset = "1";
      if (interaction.orbitDelta[0] !== 0 || interaction.orbitDelta[1] !== 0) this.root.dataset.lastOrbit = "true";
      if (interaction.zoomDelta !== 0) this.root.dataset.lastZoom = "true";
    }
  }

  private applyQuality(profile: QualityProfile): void {
    this.profile = profile;
    this.systems.particles.setQuality(profile); this.systems.protoStar.setQuality(profile); this.systems.membrane.setQuality(profile);
    this.systems.pipeline.setQuality(profile); this.resize();
  }

  private readonly onVisibilityChange = (): void => {
    if (this.disposed) return;
    if (document.hidden) { this.clock.pause(); this.pauseFrameLoop(); return; }
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
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(dpr, this.profile.pixelRatio)); this.renderer.setSize(width, height, false);
    this.systems?.pipeline.resize(width, height, dpr);
  }

  private viewport(): { width: number; height: number; dpr: number } {
    return { width: Math.max(1, this.options.canvas.clientWidth), height: Math.max(1, this.options.canvas.clientHeight), dpr: Math.max(1, window.devicePixelRatio || 1) };
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.cancelPendingResize();
    this.contextLosses += 1;
    if (this.contextLosses > 1) { this.showFallback("WebGL context was lost more than once."); return; }
    this.recovering = true; this.compileGeneration += 1; this.compiling = false; this.compiled = false; this.pauseFrameLoop(); this.firstFrame = true;
    if (this.testMode) delete this.root.dataset.showcaseReady;
    this.setState("recovering");
  };

  private readonly onContextRestored = (): void => {
    if (this.disposed || !this.recovering) return;
    try {
      this.disposeGpuSystems();
      this.systems = this.createGpuSystems(this.profile);
      this.resize(); this.recovering = false; this.compiled = false; this.setState("loading"); if (this.desiredRunning) this.start();
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

  private setTestQualityTier(tier: QualityTier): void {
    if (this.testMode) this.root.dataset.qualityTier = tier;
  }

  private setTestLayersReady(): void {
    if (!this.testMode) return;
    this.root.dataset.showcaseLayers = "5";
    this.root.dataset.reducedMotion = String(this.options.capabilities.reducedMotion);
  }

  private recordTestFrame(): void {
    if (this.testMode) this.root.dataset.renderedFrames = String(++this.renderedFrames);
  }

  private clearTestTelemetry(): void {
    if (!this.testMode) return;
    for (const key of ["showcaseReady", "qualityTier", "lastPulse", "lastReset", "reducedMotion", "showcaseLayers", "renderedFrames", "lastOrbit", "lastZoom"] as const) delete this.root.dataset[key];
  }

  private showFallback(message: string): void {
    if (this.disposed) return;
    this.setState("fallback", message); this.dispose();
  }
}
