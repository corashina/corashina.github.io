import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  capPixelRatio,
  createBackgroundScene,
  normalizePointer,
} from "./backgroundScene";
import { fragmentShader, vertexShader } from "./shaders";

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
});

describe("background shaders", () => {
  it("implements four-octave displaced pointer-reactive terrain", () => {
    expect(vertexShader).toContain("for(int i=0;i<4;i++)");
    expect(vertexShader).toContain("vec2(uTime*0.018,-uTime*0.012)");
    expect(vertexShader).toContain("exp(-distance(position.xy,focus)*0.0025)");
    expect(vertexShader).toContain("position+normal*h");
  });

  it("fades the monochrome wire intensity from displaced height", () => {
    expect(fragmentShader).toContain("uniform vec3 uColor;");
    expect(fragmentShader).toContain("uniform float uOpacity;");
    expect(fragmentShader).toContain("smoothstep(-220.0,260.0,vHeight)");
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

  it("builds the approved restrained two-layer wireframe field", () => {
    const { controller, renderer } = createHarness();

    controller.renderStatic();

    const meshes = renderedScene(renderer).children as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >[];
    expect(meshes).toHaveLength(2);
    expect(meshes[0].geometry.parameters).toMatchObject({
      width: 3600,
      height: 2400,
      widthSegments: 120,
      heightSegments: 80,
    });
    expect(meshes.map((mesh) => mesh.position.z)).toEqual([0, -135]);
    expect(meshes.map((mesh) => mesh.material.wireframe)).toEqual([true, true]);
    expect(meshes.map((mesh) => mesh.material.uniforms.uAmplitude.value)).toEqual([210, 150]);
    expect(meshes.map((mesh) => mesh.material.uniforms.uOpacity.value)).toEqual([0.68, 0.22]);
  });

  it("renders reduced motion at fixed time without scheduling animation", () => {
    const { controller, dependencies, renderer } = createHarness();

    controller.renderStatic();

    const meshes = renderedScene(renderer).children as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >[];
    expect(meshes.map((mesh) => mesh.material.uniforms.uTime.value)).toEqual([18, 18]);
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
    expect(camera.position.toArray()).toEqual([0, -180, 1050]);
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

  it("animates with damped pointer, camera, wire, and clear-color interpolation", () => {
    const { callbacks, controller, renderer } = createHarness();

    controller.setPointer(1, -1);
    controller.setTheme({ wire: "#b7b7b7", background: "#ffffff" });
    controller.start();
    callbacks.get(1)?.(1_000);

    const scene = renderedScene(renderer);
    const meshes = scene.children as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[];
    const pointer = meshes[0].material.uniforms.uPointer.value as THREE.Vector2;
    const camera = renderer.render.mock.calls.at(-1)?.[1] as THREE.PerspectiveCamera;
    const wire = meshes[0].material.uniforms.uColor.value as THREE.Color;
    const clear = renderer.setClearColor.mock.calls.at(-1)?.[0] as THREE.Color;
    expect(pointer.x).toBeGreaterThan(0);
    expect(pointer.x).toBeLessThan(1);
    expect(pointer.y).toBeLessThan(0);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.y).toBeLessThan(-180);
    expect(wire.getHexString()).not.toBe("555555");
    expect(clear.getHexString()).not.toBe("222222");
    expect(callbacks.has(2)).toBe(true);
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
      (renderedScene(renderer).children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>)
        .material.uniforms.uTime.value as number
    );

    controller.stop();
    controller.start();
    callbacks.get(4)?.(10_000);
    const afterResume = (
      (renderedScene(renderer).children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>)
        .material.uniforms.uTime.value as number
    );
    callbacks.get(5)?.(10_250);
    const afterNextFrame = (
      (renderedScene(renderer).children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>)
        .material.uniforms.uTime.value as number
    );

    expect(beforePause).toBeCloseTo(0.5);
    expect(afterResume).toBeCloseTo(beforePause);
    expect(afterNextFrame).toBeCloseTo(0.75);
  });

  it("stops and disposes the frame, geometry, materials, and renderer", () => {
    const { callbacks, controller, dependencies, renderer } = createHarness();
    controller.renderStatic();
    const meshes = renderedScene(renderer).children as THREE.Mesh<
      THREE.PlaneGeometry,
      THREE.ShaderMaterial
    >[];
    const geometryDispose = vi.spyOn(meshes[0].geometry, "dispose");
    const materialDisposes = meshes.map((mesh) => vi.spyOn(mesh.material, "dispose"));

    controller.start();
    controller.stop();
    expect(dependencies.cancelFrame).toHaveBeenCalledWith(1);
    expect(callbacks.size).toBe(0);

    controller.start();
    controller.dispose();

    expect(dependencies.cancelFrame).toHaveBeenLastCalledWith(2);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDisposes[0]).toHaveBeenCalledOnce();
    expect(materialDisposes[1]).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });
});
