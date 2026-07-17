import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  capPixelRatio,
  createBackgroundScene,
  normalizePointer,
  normalizePointerSpeed,
} from "./backgroundScene";

function createSceneSetup(onFailure = vi.fn()) {
  const canvas = document.createElement("canvas");
  const renderer = {
    compile: vi.fn(),
    debug: { onShaderError: null as (() => void) | null },
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  const dependencies = {
    createRenderer: vi.fn(() => renderer as unknown as THREE.WebGLRenderer),
    requestFrame: vi.fn((callback) => {
      const id = nextFrame++;
      callbacks.set(id, callback);
      return id;
    }),
    cancelFrame: vi.fn((id) => callbacks.delete(id)),
    onFailure,
  };

  return { callbacks, canvas, dependencies, onFailure, renderer };
}

function createHarness() {
  const setup = createSceneSetup();
  const controller = createBackgroundScene(setup.canvas, setup.dependencies);

  return { ...setup, controller };
}

function renderedScene(renderer: ReturnType<typeof createHarness>["renderer"]): THREE.Scene {
  return renderer.render.mock.calls.at(-1)?.[0] as THREE.Scene;
}

function renderedField(renderer: ReturnType<typeof createSceneSetup>["renderer"]): THREE.Group {
  return renderedScene(renderer).children.find(
    (child) => child instanceof THREE.Group,
  ) as THREE.Group;
}

function advanceFrames(
  callbacks: Map<number, FrameRequestCallback>,
  count: number,
  deltaMs: number,
): void {
  for (let frame = 1; frame <= count; frame += 1) {
    callbacks.get(frame)?.(1_000 + (frame - 1) * deltaMs);
  }
}

function ambientDrawCount(renderer: ReturnType<typeof createSceneSetup>["renderer"]): number {
  return ((renderedField(renderer).children[0] as THREE.Points).geometry as THREE.BufferGeometry)
    .drawRange.count;
}

describe("background scene helpers", () => {
  it("caps device pixel ratio", () => {
    expect(capPixelRatio(1)).toBe(1);
    expect(capPixelRatio(2)).toBe(1.5);
    expect(capPixelRatio(0)).toBe(1);
  });

  it("normalizes pointer around center", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 } as DOMRect;

    expect(normalizePointer(110, 70, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizePointer(210, 20, rect)).toEqual({ x: 1, y: 1 });
  });

  it("normalizes pointer speed by time and canvas size", () => {
    const rect = { width: 1_000, height: 500 } as DOMRect;

    expect(normalizePointerSpeed(100, 0, 16, rect)).toBeCloseTo(1);
    expect(normalizePointerSpeed(0, 0, 0, rect)).toBe(0);
    expect(normalizePointerSpeed(10_000, 0, 16, rect)).toBe(1);
  });
});

describe("background scene controller", () => {
  it("preflights shader compilation and disposes once when it fails", () => {
    const setup = createSceneSetup();
    setup.renderer.compile.mockImplementation(() => {
      setup.renderer.debug.onShaderError?.();
    });

    expect(() => createBackgroundScene(setup.canvas, setup.dependencies)).toThrow(
      "Background shader compilation failed",
    );
    expect(setup.onFailure).toHaveBeenCalledOnce();
    expect(setup.renderer.dispose).toHaveBeenCalledOnce();
  });

  it("builds the dense constellation instead of wireframe planes", () => {
    const { controller, renderer } = createHarness();

    controller.renderStatic();

    const field = renderedField(renderer);
    expect(field.children[0]).toBeInstanceOf(THREE.Points);
    expect((field.children[1] as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.InstancedBufferGeometry,
    );
    expect(field.children[2]).toBeInstanceOf(THREE.LineSegments);
  });

  it("renders reduced motion at fixed time without scheduling animation", () => {
    const { controller, dependencies, renderer } = createHarness();

    controller.renderStatic();

    const field = renderedField(renderer);
    const materials = field.children.map(
      (child) => (child as THREE.Points | THREE.Mesh | THREE.LineSegments).material,
    ) as THREE.ShaderMaterial[];
    expect(materials.map((material) => material.uniforms.uTime.value)).toEqual([18, 18, 18]);
    expect(materials[0].uniforms.uPointer.value).toEqual(new THREE.Vector3(0, 0, 0));
    expect(materials[0].uniforms.uPointerSpeed.value).toBe(0);
    expect(dependencies.requestFrame).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it("caps DPR, updates projection, and leaves CSS sizing to the component", () => {
    const { controller, renderer } = createHarness();

    controller.resize(900, 600, 3);
    controller.renderStatic();

    const camera = renderer.render.mock.calls.at(-1)?.[1] as THREE.PerspectiveCamera;
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(renderer.setSize).toHaveBeenCalledWith(900, 600, false);
    expect(camera.aspect).toBe(1.5);
    expect(camera.position.toArray()).toEqual([0, 0, 1050]);
    const contentMask = (
      (renderedField(renderer).children[0] as THREE.Points).material as THREE.ShaderMaterial
    ).uniforms.uContentMask.value as THREE.Vector4;
    expect(contentMask.toArray()).toEqual([0.5, 0.5, 0.28, 0.42]);
  });

  it.each([
    { width: 0, height: 600, safeWidth: 1, safeHeight: 600 },
    { width: 900, height: 0, safeWidth: 900, safeHeight: 1 },
  ])(
    "keeps renderer and projection dimensions safe for $width x $height",
    ({ width, height, safeWidth, safeHeight }) => {
      const { controller, renderer } = createHarness();

      controller.resize(width, height, 1);
      controller.renderStatic();

      const camera = renderer.render.mock.calls.at(-1)?.[1] as THREE.PerspectiveCamera;
      expect(renderer.setSize).toHaveBeenCalledWith(safeWidth, safeHeight, false);
      expect(camera.aspect).toBe(safeWidth / safeHeight);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    },
  );

  it("passes damped pointer position and speed into the field", () => {
    const { callbacks, controller, renderer } = createHarness();

    controller.setPointer(1, -1, 0.8);
    controller.start();
    callbacks.get(1)?.(1_000);

    const uniforms = (
      (renderedField(renderer).children[0] as THREE.Points).material as THREE.ShaderMaterial
    ).uniforms;
    const pointer = uniforms.uPointer.value as THREE.Vector3;
    expect(pointer.x).toBeGreaterThan(0);
    expect(pointer.x).toBeLessThan(900);
    expect(pointer.y).toBeLessThan(0);
    expect(uniforms.uPointerSpeed.value).toBeGreaterThan(0);
    expect(uniforms.uPointerSpeed.value).toBeLessThan(0.8);
    expect(callbacks.has(2)).toBe(true);
  });

  it("interpolates the full palette and changes blend mode", () => {
    const { callbacks, controller, renderer } = createHarness();

    controller.setTheme({
      particle: "#555555",
      signal: "#333333",
      connection: "#777777",
      background: "#ffffff",
      blendMode: "normal",
    });
    controller.start();
    callbacks.get(1)?.(1_000);

    const materials = renderedField(renderer).children.map(
      (child) => (child as THREE.Points | THREE.Mesh | THREE.LineSegments).material,
    ) as THREE.ShaderMaterial[];
    expect(materials.every((material) => material.blending === THREE.NormalBlending)).toBe(true);
    expect(materials[0].uniforms.uParticleColor.value.getHexString()).not.toBe("aeb4ba");
    expect(materials[1].uniforms.uSignalColor.value.getHexString()).not.toBe("f4f6f7");
    expect(materials[2].uniforms.uConnectionColor.value.getHexString()).not.toBe("697078");
    expect(
      (renderer.setClearColor.mock.calls.at(-1)?.[0] as THREE.Color).getHexString(),
    ).not.toBe("222222");
  });

  it("reports an asynchronous render failure once, stops frames, and disposes", () => {
    const { callbacks, controller, dependencies, onFailure, renderer } = createHarness();
    renderer.render.mockImplementationOnce(() => {
      throw new Error("render failed");
    });

    controller.start();
    callbacks.get(1)?.(1_000);

    expect(onFailure).toHaveBeenCalledOnce();
    expect(dependencies.requestFrame).toHaveBeenCalledOnce();
    expect(callbacks.has(2)).toBe(false);
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("reports a static render failure once and disposes resources once", () => {
    const { controller, dependencies, onFailure, renderer } = createHarness();
    renderer.render.mockImplementationOnce(() => {
      throw new Error("static render failed");
    });

    controller.renderStatic();
    controller.renderStatic();

    expect(onFailure).toHaveBeenCalledOnce();
    expect(dependencies.requestFrame).not.toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("disposes on context loss and removes its listener", () => {
    const setup = createSceneSetup();
    const removeEventListener = vi.spyOn(setup.canvas, "removeEventListener");
    const controller = createBackgroundScene(setup.canvas, setup.dependencies);
    const contextLost = new Event("webglcontextlost", { cancelable: true });

    setup.canvas.dispatchEvent(contextLost);
    controller.dispose();

    expect(contextLost.defaultPrevented).toBe(true);
    expect(setup.onFailure).toHaveBeenCalledOnce();
    expect(setup.renderer.dispose).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith(
      "webglcontextlost",
      expect.any(Function),
    );
  });

  it("accumulates only visible frame deltas when animation resumes", () => {
    const { callbacks, controller, renderer } = createHarness();

    controller.start();
    callbacks.get(1)?.(1_000);
    callbacks.get(2)?.(1_500);
    const beforePause = (
      (renderedField(renderer).children[0] as THREE.Points).material as THREE.ShaderMaterial
    ).uniforms.uTime.value as number;

    controller.stop();
    controller.start();
    callbacks.get(4)?.(10_000);
    const afterResume = (
      (renderedField(renderer).children[0] as THREE.Points).material as THREE.ShaderMaterial
    ).uniforms.uTime.value as number;
    callbacks.get(5)?.(10_250);
    const afterNextFrame = (
      (renderedField(renderer).children[0] as THREE.Points).material as THREE.ShaderMaterial
    ).uniforms.uTime.value as number;

    expect(beforePause).toBeCloseTo(0.5);
    expect(afterResume).toBeCloseTo(beforePause);
    expect(afterNextFrame).toBeCloseTo(0.75);
  });

  it("stops and disposes the frame, geometry, materials, and renderer", () => {
    const { callbacks, controller, dependencies, renderer } = createHarness();
    controller.renderStatic();
    const field = renderedField(renderer);
    const resources = field.children.flatMap((child) => {
      const renderable = child as THREE.Points | THREE.Mesh | THREE.LineSegments;
      return [renderable.geometry, renderable.material];
    }) as Array<{ dispose(): void }>;
    const resourceDisposes = resources.map((resource) => vi.spyOn(resource, "dispose"));

    controller.start();
    controller.stop();
    expect(dependencies.cancelFrame).toHaveBeenCalledWith(1);
    expect(callbacks.size).toBe(0);

    controller.start();
    controller.dispose();

    expect(dependencies.cancelFrame).toHaveBeenLastCalledWith(2);
    resourceDisposes.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it("fades from high to medium after a sustained slow-frame window", () => {
    const setup = createSceneSetup();
    const controller = createBackgroundScene(setup.canvas, {
      ...setup.dependencies,
      hardwareConcurrency: 12,
    });
    controller.resize(1_440, 900, 1.5);
    controller.start();
    advanceFrames(setup.callbacks, 136, 25);
    expect(ambientDrawCount(setup.renderer)).toBe(6_000);
  });

  it("keeps high quality during a sustained 60 fps sample", () => {
    const setup = createSceneSetup();
    const controller = createBackgroundScene(setup.canvas, {
      ...setup.dependencies,
      hardwareConcurrency: 12,
    });
    controller.resize(1_440, 900, 1.5);
    controller.start();
    advanceFrames(setup.callbacks, 140, 16);
    expect(ambientDrawCount(setup.renderer)).toBe(10_000);
  });
});
