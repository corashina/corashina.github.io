import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { MaskedBloomPass } from "./MaskedBloomPass";

describe("MaskedBloomPass", () => {
  it("restores standalone renderer, stencil, pass, and blend state when bloom throws", () => {
    const pass = new MaskedBloomPass(4, 4);
    pass.setEnergyTexture(new THREE.Texture());
    pass.renderToScreen = true;
    const previousTarget = new THREE.WebGLRenderTarget(2, 2);
    let target: THREE.WebGLRenderTarget | null = previousTarget;
    let clearColor = new THREE.Color(0x123456);
    let clearAlpha = 0.4;
    const stencil = { setTest: vi.fn() };
    const renderer = {
      autoClear: false,
      state: { buffers: { stencil } },
      getRenderTarget: () => target,
      setRenderTarget: (value: THREE.WebGLRenderTarget | null) => { target = value; },
      getClearColor: (value: THREE.Color) => value.copy(clearColor),
      getClearAlpha: () => clearAlpha,
      setClearColor: (value: THREE.ColorRepresentation, alpha?: number) => { clearColor = new THREE.Color(value); if (alpha !== undefined) clearAlpha = alpha; },
      setClearAlpha: (value: number) => { clearAlpha = value; },
      clear: vi.fn(), render: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const internalQuad = (pass as unknown as { _fsQuad: { render(renderer: THREE.WebGLRenderer): void } })._fsQuad;
    const previousInternalMaterial = (internalQuad as unknown as { material: THREE.Material | null }).material;
    vi.spyOn(internalQuad, "render").mockImplementation(() => { throw new Error("bloom draw failed"); });
    const oldDiffuse = pass.blendMaterial.uniforms.tDiffuse!.value;
    const read = new THREE.WebGLRenderTarget(4, 4); const write = new THREE.WebGLRenderTarget(4, 4);

    expect(() => pass.render(renderer, write, read, 0, true)).toThrow("bloom draw failed");
    expect(target).toBe(previousTarget);
    expect(renderer.autoClear).toBe(false);
    expect(clearColor.getHex()).toBe(0x123456); expect(clearAlpha).toBe(0.4);
    expect(stencil.setTest).toHaveBeenLastCalledWith(true);
    expect(pass.renderToScreen).toBe(true);
    expect(pass.blendMaterial.blending).toBe(THREE.AdditiveBlending);
    expect(pass.blendMaterial.uniforms.tDiffuse!.value).toBe(oldDiffuse);
    expect((internalQuad as unknown as { material: THREE.Material | null }).material).toBe(previousInternalMaterial);
    const highPassDispose = vi.spyOn(pass.materialHighPassFilter, "dispose");
    pass.dispose();
    expect(highPassDispose).toHaveBeenCalledTimes(1);
    previousTarget.dispose(); read.dispose(); write.dispose();
  });
});
