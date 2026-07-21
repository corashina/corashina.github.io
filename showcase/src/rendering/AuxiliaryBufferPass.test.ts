import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { AuxiliaryBufferPass } from "./AuxiliaryBufferPass";

describe("AuxiliaryBufferPass", () => {
  it("owns a half-float two-attachment target with depth, clamped sizing, and idempotent disposal", () => {
    const pass = new AuxiliaryBufferPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    const targetDispose = vi.spyOn(pass.target, "dispose");
    const materialDispose = vi.spyOn(pass.material, "dispose");

    expect(pass.target.texture.type).toBe(THREE.HalfFloatType);
    expect(pass.target.textures).toHaveLength(2);
    expect(pass.target.depthTexture).toBeInstanceOf(THREE.DepthTexture);
    expect(pass.normalTexture).toBe(pass.target.textures[0]);
    expect(pass.energyTexture).toBe(pass.target.textures[1]);

    pass.setSize(0.5, -3);
    expect(pass.target.width).toBe(1);
    expect(pass.target.height).toBe(1);

    pass.dispose();
    pass.dispose();
    expect(targetDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("restores original materials, callbacks, and renderer state when auxiliary rendering throws", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    const originalCallback = vi.fn();
    mesh.onBeforeRender = originalCallback;
    scene.add(mesh);
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    const previousTarget = new THREE.WebGLRenderTarget(1, 1);
    const renderer = {
      autoClear: false,
      getRenderTarget: () => previousTarget,
      setRenderTarget: vi.fn(),
      clear: vi.fn(),
      render: () => { throw new Error("draw failure"); },
    } as unknown as THREE.WebGLRenderer;

    expect(() => pass.render(renderer)).toThrow("draw failure");
    expect(mesh.material).not.toBe(pass.material);
    expect(mesh.onBeforeRender).toBe(originalCallback);
    expect(renderer.autoClear).toBe(false);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget);
    pass.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    previousTarget.dispose();
  });

  it("uses raw GLSL3 ownership and leaves every scene object untouched when renderer state capture fails", () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    scene.add(mesh, points);
    const originalMaterial = mesh.material;
    const pass = new AuxiliaryBufferPass(scene, new THREE.PerspectiveCamera());
    const renderer = { getRenderTarget: () => { throw new Error("state unavailable"); } } as unknown as THREE.WebGLRenderer;

    expect(pass.material).toBeInstanceOf(THREE.RawShaderMaterial);
    expect(pass.material.vertexShader).toContain("uniform mat4 modelViewMatrix");
    expect(pass.material.vertexShader).toContain("in vec3 position");
    expect(() => pass.render(renderer)).toThrow("state unavailable");
    expect(mesh.material).toBe(originalMaterial);
    expect(points.visible).toBe(true);
    pass.dispose();
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    points.geometry.dispose();
    (points.material as THREE.Material).dispose();
  });
});
