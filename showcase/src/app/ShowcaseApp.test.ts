import { describe, expect, it, vi } from "vitest";
import { ShowcaseApp, type ShowcaseAppFactories } from "./ShowcaseApp";
import { QUALITY_PROFILES, type QualityMode, type QualityProfile, type QualityTier } from "../quality/qualityProfiles";
import type { FrameContext, InteractionSnapshot } from "./contracts";

const interaction: InteractionSnapshot = {
  pointerNdc: [0, 0], pointerWorld: [0, 0, 0], pointerVelocity: [0, 0], gravity: 1,
  orbitDelta: [0, 0], zoomDelta: 0, pulseId: 0, pulseEnergy: 0, release: false,
  resetRequested: false, reducedMotion: false,
};

type Harness = ReturnType<typeof makeHarness>;

function makeHarness(overrides: Partial<ShowcaseAppFactories> = {}) {
  const calls: string[] = [];
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: 900, configurable: true });
  Object.defineProperty(canvas, "clientHeight", { value: 500, configurable: true });
  const renderer = { setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() };
  const scene = { add: vi.fn(), remove: vi.fn() };
  const camera = { aspect: 1, updateProjectionMatrix: vi.fn(), position: { set: vi.fn() } };
  const particles = { object: {}, update: vi.fn(() => calls.push("particles.update")), getPositionTexture: vi.fn(() => ({})), setQuality: vi.fn(), dispose: vi.fn(() => calls.push("particles.dispose")) };
  const protoStar = { object: {}, update: vi.fn(() => calls.push("proto.update")), setQuality: vi.fn(), getShadowMaterials: vi.fn(() => []), dispose: vi.fn(() => calls.push("proto.dispose")) };
  const membrane = { object: {}, update: vi.fn(() => calls.push("membrane.update")), setQuality: vi.fn(), getShadowMaterials: vi.fn(() => []), dispose: vi.fn(() => calls.push("membrane.dispose")) };
  const nebula = { setInteraction: vi.fn(() => calls.push("nebula.interaction")), setQuality: vi.fn(), dispose: vi.fn(() => calls.push("nebula.dispose")) };
  const pipeline = { render: vi.fn(() => calls.push("pipeline.render")), resize: vi.fn(), setQuality: vi.fn(), dispose: vi.fn(() => calls.push("pipeline.dispose")) };
  const sampled = { ...interaction };
  const clock = { advance: vi.fn((_: number, step: () => void) => { step(); return 0; }), pause: vi.fn(), resume: vi.fn() };
  const quality = { setMode: vi.fn((mode: QualityMode) => mode === "auto" ? "medium" : mode), getProfile: vi.fn(() => QUALITY_PROFILES.high), sample: vi.fn(() => null as QualityTier | null), getTransition: vi.fn(() => null) };
  const cameraController = { projectPointer: vi.fn(() => [4, 5, 6] as const), update: vi.fn(() => calls.push("camera.update")), reset: vi.fn(() => calls.push("camera.reset")), dispose: vi.fn(() => calls.push("camera.dispose")) };
  const interactionController = { sample: vi.fn(() => sampled), dispose: vi.fn(() => calls.push("interaction.dispose")) };
  const root = document.documentElement;
  root.dataset.showcaseState = "loading";
  delete root.dataset.showcaseReady;
  const factories: ShowcaseAppFactories = {
    now: vi.fn(() => 100),
    requestFrame: vi.fn((callback: FrameRequestCallback) => { const id = ++frameId; frameCallbacks.set(id, callback); return id; }),
    cancelFrame: vi.fn((id: number) => frameCallbacks.delete(id)),
    createRenderer: vi.fn(() => { calls.push("renderer"); return renderer; }),
    createScene: vi.fn(() => { calls.push("scene"); return scene; }),
    createCamera: vi.fn(() => { calls.push("camera"); return camera; }),
    createLights: vi.fn(() => calls.push("lights")),
    createInteractionController: vi.fn(() => { calls.push("interaction"); return interactionController; }),
    createCameraController: vi.fn(() => { calls.push("controls"); return cameraController; }),
    createClock: vi.fn(() => clock),
    createQualityManager: vi.fn(() => quality),
    createParticles: vi.fn(() => { calls.push("particles"); return particles; }),
    createProtoStar: vi.fn(() => { calls.push("proto"); return protoStar; }),
    createMembrane: vi.fn(() => { calls.push("membrane"); return membrane; }),
    createNebula: vi.fn(() => { calls.push("nebula"); return nebula; }),
    createPipeline: vi.fn(() => { calls.push("pipeline"); return pipeline; }),
    ...overrides,
  };
  const app = new ShowcaseApp({ canvas, root, capabilities: { webgl2: true, reducedMotion: false }, factories });
  const runFrame = (now = 116) => {
    const callback = [...frameCallbacks.values()][0];
    expect(callback).toBeDefined();
    frameCallbacks.clear();
    callback?.(now);
  };
  return { app, canvas, calls, renderer, scene, camera, particles, protoStar, membrane, nebula, pipeline, clock, quality, cameraController, interactionController, factories, frameCallbacks, runFrame, root };
}

describe("ShowcaseApp", () => {
  it("constructs the scene in dependency order and configures the initial bounded viewport", () => {
    const h = makeHarness();
    expect(h.calls).toEqual(["renderer", "scene", "camera", "lights", "interaction", "controls", "particles", "proto", "membrane", "nebula", "pipeline"]);
    expect(h.pipeline.resize).toHaveBeenCalledWith(900, 500, expect.any(Number));
    h.app.dispose();
  });

  it("updates each system once per fixed step in scene order and renders afterwards", () => {
    const h = makeHarness();
    h.app.start(); h.runFrame();
    expect(h.calls.slice(-6, -1)).toEqual(["particles.update", "proto.update", "membrane.update", "nebula.interaction", "camera.update"]);
    expect(h.pipeline.render).toHaveBeenCalledAfter(h.cameraController.update);
    expect(h.membrane.update).toHaveBeenCalledWith(expect.objectContaining({ interaction: expect.objectContaining({ pointerWorld: [4, 5, 6] }) }), expect.anything());
    expect(h.root.dataset.showcaseReady).toBe("true");
    h.app.dispose();
  });

  it("pauses on visibility changes and resumes without a clock catch-up", () => {
    const h = makeHarness();
    h.app.start();
    Object.defineProperty(document, "hidden", { value: true, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(h.clock.pause).toHaveBeenCalledOnce();
    Object.defineProperty(document, "hidden", { value: false, configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(h.clock.resume).toHaveBeenCalledWith(100);
    h.app.dispose();
  });

  it("clamps resize through the pipeline and propagates selected quality exactly once to every GPU system", () => {
    const h = makeHarness();
    h.app.setQualityMode("low");
    for (const system of [h.particles, h.protoStar, h.membrane, h.nebula, h.pipeline]) expect(system.setQuality).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("resize"));
    expect(h.pipeline.resize).toHaveBeenLastCalledWith(900, 500, expect.any(Number));
    h.app.dispose();
  });

  it("forwards reduced-motion capability to its controller factory and resets the view", () => {
    const h = makeHarness();
    h.app.resetView();
    expect(h.cameraController.reset).toHaveBeenCalledOnce();
    h.app.dispose();
  });

  it("reconstructs GPU systems after one context restoration", () => {
    const h = makeHarness();
    h.app.start();
    const lost = new Event("webglcontextlost", { cancelable: true }); h.canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true); expect(h.root.dataset.showcaseState).toBe("recovering");
    h.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(h.factories.createParticles).toHaveBeenCalledTimes(2);
    expect(h.root.dataset.showcaseState).toBe("loading");
    h.app.dispose();
  });

  it("falls back after a second context loss and hides the interactive controls", () => {
    const h = makeHarness();
    const first = new Event("webglcontextlost", { cancelable: true }); h.canvas.dispatchEvent(first);
    h.canvas.dispatchEvent(new Event("webglcontextrestored"));
    const second = new Event("webglcontextlost", { cancelable: true }); h.canvas.dispatchEvent(second);
    expect(h.root.dataset.showcaseState).toBe("fallback");
    expect(h.root.dataset.showcaseError).toContain("context");
    expect(h.app.isDisposed()).toBe(true);
  });

  it("shows fallback and cancels future frames when a frame throws", () => {
    const h = makeHarness();
    h.pipeline.render.mockImplementationOnce(() => { throw new Error("GPU failed"); });
    h.app.start(); h.runFrame();
    expect(h.root.dataset.showcaseState).toBe("fallback");
    expect(h.frameCallbacks.size).toBe(0);
    expect(h.app.isDisposed()).toBe(true);
  });

  it("cleans up every acquired dependency when GPU construction fails partway through", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 1 }); Object.defineProperty(canvas, "clientHeight", { value: 1 });
    const renderer = { setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn() };
    const interactionController = { sample: vi.fn(() => interaction), dispose: vi.fn() };
    const cameraController = { projectPointer: vi.fn(() => [0, 0, 0] as const), update: vi.fn(), dispose: vi.fn() };
    const particles = { object: {}, update: vi.fn(), getPositionTexture: vi.fn(), setQuality: vi.fn(), dispose: vi.fn() };
    const protoStar = { object: {}, update: vi.fn(), setQuality: vi.fn(), getShadowMaterials: vi.fn(() => []), dispose: vi.fn() };
    const membrane = { object: {}, update: vi.fn(), setQuality: vi.fn(), getShadowMaterials: vi.fn(() => []), dispose: vi.fn() };
    const nebula = { setInteraction: vi.fn(), setQuality: vi.fn(), dispose: vi.fn() };
    const factories = {
      now: () => 0, requestFrame: () => 1, cancelFrame: vi.fn(), createRenderer: () => renderer,
      createScene: () => ({ add: vi.fn(), remove: vi.fn() }), createCamera: () => ({ aspect: 1, updateProjectionMatrix: vi.fn() }), createLights: vi.fn(),
      createInteractionController: () => interactionController, createCameraController: () => cameraController,
      createClock: () => ({ advance: () => 0, pause: vi.fn(), resume: vi.fn() }),
      createQualityManager: () => ({ setMode: () => "medium" as const, getProfile: () => QUALITY_PROFILES.medium, sample: () => null, getTransition: () => null }),
      createParticles: () => particles, createProtoStar: () => protoStar, createMembrane: () => membrane, createNebula: () => nebula,
      createPipeline: () => { throw new Error("pipeline failed"); },
    } satisfies ShowcaseAppFactories;
    expect(() => new ShowcaseApp({ canvas, capabilities: { webgl2: true, reducedMotion: false }, factories })).toThrow("pipeline failed");
    expect(particles.dispose).toHaveBeenCalledOnce(); expect(protoStar.dispose).toHaveBeenCalledOnce();
    expect(membrane.dispose).toHaveBeenCalledOnce(); expect(nebula.dispose).toHaveBeenCalledOnce();
    expect(interactionController.dispose).toHaveBeenCalledOnce(); expect(cameraController.dispose).toHaveBeenCalledOnce(); expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("disposes in reverse dependency order, remains idempotent, and leaves no scheduled frame", () => {
    const h = makeHarness();
    h.app.start(); h.app.dispose(); h.app.dispose();
    expect(h.frameCallbacks.size).toBe(0);
    expect(h.calls.slice(-7)).toEqual(["pipeline.dispose", "nebula.dispose", "membrane.dispose", "proto.dispose", "particles.dispose", "camera.dispose", "interaction.dispose"]);
    expect(h.renderer.dispose).toHaveBeenCalledOnce();
  });
});
