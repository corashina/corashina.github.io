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
});
