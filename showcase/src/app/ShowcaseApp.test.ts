import { afterEach, describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "./contracts";
import { ShowcaseApp, type ShowcaseAppFactories } from "./ShowcaseApp";

const interaction: InteractionSnapshot = {
  pointerNdc: [0, 0], pointerWorld: [0, 0, 0], pointerVelocity: [0, 0], gravity: 1,
  orbitDelta: [0, 0], zoomDelta: 0, pulseId: 0, pulseCharge: 0, pulseEnergy: 0, pulseAge: 3, pulseRadius: 0, release: false,
  resetRequested: false, reducedMotion: false,
};

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  for (const key of Object.keys(document.documentElement.dataset)) delete document.documentElement.dataset[key];
});

function makeHarness(dimensions = { width: 900, height: 500 }) {
  const calls: string[] = [];
  const frameCallbacks = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "clientWidth", { value: dimensions.width, configurable: true });
  Object.defineProperty(canvas, "clientHeight", { value: dimensions.height, configurable: true });
  const renderer = { setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn() };
  const scene = { add: vi.fn(), remove: vi.fn() };
  const camera = { aspect: 1, updateProjectionMatrix: vi.fn() };
  const particles = { object: {}, update: vi.fn(() => calls.push("particles.update")), getPositionTexture: vi.fn(), dispose: vi.fn(() => calls.push("particles.dispose")) };
  const pipeline = { render: vi.fn(() => calls.push("pipeline.render")), resize: vi.fn(), dispose: vi.fn(() => calls.push("pipeline.dispose")) };
  const clock = { advance: vi.fn((_: number, step: () => void) => { step(); return 0; }), pause: vi.fn(), resume: vi.fn() };
  const cameraController = { projectPointer: vi.fn(() => [4, 5, 6] as const), update: vi.fn(() => calls.push("camera.update")), reset: vi.fn(() => calls.push("camera.reset")), dispose: vi.fn(() => calls.push("camera.dispose")) };
  const interactionController = { sample: vi.fn(() => ({ ...interaction })), dispose: vi.fn(() => calls.push("interaction.dispose")) };

  const factories = {
    now: vi.fn(() => 100),
    requestFrame: vi.fn((callback: FrameRequestCallback) => { const id = ++frameId; frameCallbacks.set(id, callback); return id; }),
    cancelFrame: vi.fn((id: number) => frameCallbacks.delete(id)),
    createRenderer: vi.fn(() => { calls.push("renderer"); return renderer; }),
    createScene: vi.fn(() => { calls.push("scene"); return scene; }),
    createCamera: vi.fn(() => { calls.push("camera"); return camera; }),
    createInteractionController: vi.fn(() => { calls.push("interaction"); return interactionController; }),
    createCameraController: vi.fn(() => { calls.push("controls"); return cameraController; }),
    createClock: vi.fn(() => clock),
    createParticles: vi.fn(() => { calls.push("particles"); return particles; }),
    createPipeline: vi.fn(() => { calls.push("pipeline"); return pipeline; }),
  } satisfies ShowcaseAppFactories;
  const root = document.documentElement;
  const app = new ShowcaseApp({ canvas, root, capabilities: { webgl2: true, reducedMotion: false }, factories, testMode: true });
  const runFrame = (now = 116): void => {
    const callback = [...frameCallbacks.values()][0];
    expect(callback).toBeDefined();
    frameCallbacks.clear();
    callback?.(now);
  };
  return { app, canvas, root, calls, renderer, scene, camera, particles, pipeline, clock, cameraController, interactionController, factories, frameCallbacks, runFrame };
}

describe("ShowcaseApp", () => {
  it("constructs only the particle scene at the fixed low pixel ratio", () => {
    const h = makeHarness();

    expect(h.calls).toEqual(["renderer", "scene", "camera", "interaction", "controls", "particles", "pipeline"]);
    expect(h.scene.add).toHaveBeenCalledWith(h.particles.object);
    expect(h.pipeline.resize).toHaveBeenCalledWith(900, 500, 1);
    expect(h.renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(h.root.dataset.showcaseLayers).toBe("1");
    expect(h.root.dataset.qualityTier).toBeUndefined();
    expect("setQualityMode" in h.app).toBe(false);
    h.app.dispose();
  });

  it("updates particles and camera before rendering", () => {
    const h = makeHarness();
    h.app.start(); h.runFrame();

    expect(h.calls.slice(-3)).toEqual(["particles.update", "camera.update", "pipeline.render"]);
    expect(h.cameraController.update).toHaveBeenCalledWith(expect.objectContaining({ interaction: expect.objectContaining({ pointerWorld: [4, 5, 6] }) }));
    expect(h.root.dataset.showcaseReady).toBe("true");
    h.app.dispose();
  });

  it("compiles before scheduling its first frame", async () => {
    let resolveCompile!: () => void;
    const h = makeHarness();
    Object.assign(h.renderer, { compileAsync: vi.fn(() => new Promise<void>((resolve) => { resolveCompile = resolve; })) });
    h.app.start();
    expect(h.frameCallbacks.size).toBe(0);
    resolveCompile(); await Promise.resolve(); await Promise.resolve();
    expect(h.frameCallbacks.size).toBe(1);
    h.app.dispose();
  });

  it("falls back on compile rejection and ignores a late compile after stop", async () => {
    const failed = makeHarness();
    Object.assign(failed.renderer, { compileAsync: vi.fn(() => Promise.reject(new Error("shader compile failed"))) });
    failed.app.start();
    await Promise.resolve(); await Promise.resolve();
    expect(failed.root.dataset.showcaseState).toBe("fallback");
    expect(failed.root.dataset.showcaseError).toContain("shader compile failed");

    let resolveCompile!: () => void;
    const stopped = makeHarness();
    Object.assign(stopped.renderer, { compileAsync: vi.fn(() => new Promise<void>((resolve) => { resolveCompile = resolve; })) });
    stopped.app.start(); stopped.app.stop(); resolveCompile();
    await Promise.resolve(); await Promise.resolve();
    expect(stopped.frameCallbacks.size).toBe(0);
    stopped.app.dispose();
  });

  it("pauses while hidden and resumes without catch-up", () => {
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

  it("coalesces resize and skips a settled zero-sized canvas", () => {
    vi.useFakeTimers();
    const h = makeHarness();
    window.dispatchEvent(new Event("resize")); window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(99);
    expect(h.pipeline.resize).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(h.pipeline.resize).toHaveBeenCalledTimes(2);
    Object.defineProperty(h.canvas, "clientWidth", { value: 0, configurable: true });
    window.dispatchEvent(new Event("resize")); vi.advanceTimersByTime(100);
    expect(h.pipeline.resize).toHaveBeenCalledTimes(2);
    h.app.dispose();
  });

  it("enters fallback when settled resize allocation fails", () => {
    vi.useFakeTimers();
    const h = makeHarness();
    h.pipeline.resize.mockImplementationOnce(() => { throw new Error("resize allocation failed"); });

    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(100);

    expect(h.root.dataset.showcaseState).toBe("fallback");
    expect(h.root.dataset.showcaseError).toContain("resize allocation failed");
    expect(h.app.isDisposed()).toBe(true);
  });

  it("uses a one-pixel viewport for an initially zero-sized canvas", () => {
    const h = makeHarness({ width: 0, height: 0 });

    expect(h.renderer.setSize).toHaveBeenCalledWith(1, 1, false);
    expect(h.pipeline.resize).toHaveBeenCalledWith(1, 1, 1);
    h.app.dispose();
  });

  it("keeps reduced-motion input and Reset View behavior", () => {
    const h = makeHarness();
    h.app.resetView();
    expect(h.cameraController.reset).toHaveBeenCalledOnce();
    expect(h.root.dataset.reducedMotion).toBe("false");
    h.app.dispose();
  });

  it("reconstructs only particles and pipeline after one context restoration", () => {
    const h = makeHarness();
    h.app.start(); h.runFrame();
    const lost = new Event("webglcontextlost", { cancelable: true }); h.canvas.dispatchEvent(lost);
    expect(lost.defaultPrevented).toBe(true);
    expect(h.root.dataset.showcaseState).toBe("recovering");
    h.canvas.dispatchEvent(new Event("webglcontextrestored"));
    expect(h.factories.createParticles).toHaveBeenCalledTimes(2);
    expect(h.factories.createPipeline).toHaveBeenCalledTimes(2);
    expect(h.root.dataset.showcaseState).toBe("loading");
    h.app.dispose();
  });

  it("cleans up particles when pipeline construction fails", () => {
    const h = makeHarness();
    h.app.dispose();
    const factories = { ...h.factories, createPipeline: () => { throw new Error("pipeline failed"); } } as ShowcaseAppFactories;

    expect(() => new ShowcaseApp({ canvas: h.canvas, capabilities: { webgl2: true, reducedMotion: false }, factories })).toThrow("pipeline failed");
    expect(h.particles.dispose).toHaveBeenCalledTimes(2);
  });

  it("falls back on a frame error and disposes in reverse dependency order exactly once", () => {
    const h = makeHarness();
    h.pipeline.render.mockImplementationOnce(() => { throw new Error("GPU failed"); });
    h.app.start(); h.runFrame(); h.app.dispose();

    expect(h.root.dataset.showcaseState).toBe("fallback");
    expect(h.frameCallbacks.size).toBe(0);
    expect(h.calls.slice(-4)).toEqual(["pipeline.dispose", "particles.dispose", "camera.dispose", "interaction.dispose"]);
    expect(h.renderer.dispose).toHaveBeenCalledOnce();
  });

  it("disposes an explicitly stopped app idempotently", () => {
    const h = makeHarness();
    h.app.start(); h.app.stop(); h.app.dispose(); h.app.dispose();

    expect(h.frameCallbacks.size).toBe(0);
    expect(h.pipeline.dispose).toHaveBeenCalledOnce();
    expect(h.particles.dispose).toHaveBeenCalledOnce();
    expect(h.renderer.dispose).toHaveBeenCalledOnce();
  });

  it("falls back after a second context loss and clears test telemetry", () => {
    const h = makeHarness();
    h.app.start(); h.runFrame();
    h.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    h.canvas.dispatchEvent(new Event("webglcontextrestored"));
    h.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));

    expect(h.root.dataset.showcaseState).toBe("fallback");
    for (const key of ["showcaseReady", "qualityTier", "lastPulse", "lastReset", "reducedMotion", "showcaseLayers", "renderedFrames", "lastOrbit", "lastZoom"]) {
      expect(h.root.dataset[key]).toBeUndefined();
    }
  });
});
