import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBackgroundScene } from "./backgroundScene";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("caps visible frame deltas and excludes hidden time when animation resumes", () => {
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

    expect(beforePause).toBeCloseTo(0.05);
    expect(afterResume).toBeCloseTo(beforePause);
    expect(afterNextFrame).toBeCloseTo(0.1);
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

});
