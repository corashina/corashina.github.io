import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { NebulaPass } from "./NebulaPass";

const interaction = {
  pointerNdc: [0, 0], pointerWorld: [1, 2, 3], pointerVelocity: [0, 0], gravity: 0,
  orbitDelta: [0, 0], zoomDelta: 0, pulseId: 1, pulseCharge: 0.5, pulseEnergy: 0.4,
  pulseAge: 0.7, pulseRadius: 3.75, release: false, resetRequested: false, reducedMotion: false,
} as const;

describe("NebulaPass", () => {
  it("uses the finite interaction pulse radius and clears after its envelope ends", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.low);
    pass.setInteraction(interaction);
    expect(pass.material.uniforms.uPulseRadius!.value).toBe(3.75);
    pass.setInteraction({ ...interaction, pulseEnergy: 0, pulseRadius: 0 });
    expect(pass.material.uniforms.uPulseRadius!.value).toBe(0);
    pass.dispose();
  });
  it.each([
    ["ultra", 96, 0.5], ["high", 72, 0.5], ["medium", 48, 0.5], ["low", 28, 0.35],
  ] as const)("maps %s quality to raymarch steps and target scale", (tier, steps, scale) => {
    const pass = new NebulaPass(QUALITY_PROFILES[tier]);
    pass.setSize(1000, 600);

    expect(pass.material.uniforms.uMaxSteps!.value).toBe(steps);
    expect(pass.renderTarget.width).toBe(Math.floor(1000 * scale));
    expect(pass.renderTarget.height).toBe(Math.floor(600 * scale));
    pass.dispose();
  });

  it("reallocates at the new quality scale and disposes owned GPU resources once", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.high);
    pass.setSize(1000, 600);
    const densityDispose = vi.spyOn(pass.densityTexture, "dispose");
    const materialDispose = vi.spyOn(pass.material, "dispose");
    const quadDispose = vi.spyOn(pass.quad, "dispose");
    const targetDispose = vi.spyOn(pass.renderTarget, "dispose");

    pass.setQuality(QUALITY_PROFILES.low);
    expect(pass.renderTarget.width).toBe(350);
    expect(pass.renderTarget.height).toBe(210);

    pass.dispose();
    pass.dispose();

    expect(densityDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(quadDispose).toHaveBeenCalledTimes(1);
    expect(targetDispose).toHaveBeenCalledTimes(1);
  });

  it("keeps the scene at full resolution until the final composite", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.low);
    const readBuffer = new THREE.WebGLRenderTarget(1000, 600);
    const writeBuffer = new THREE.WebGLRenderTarget(1000, 600);
    const targets: Array<THREE.WebGLRenderTarget | null> = [];
    const renderer = {
      capabilities: { isWebGL2: true },
      setRenderTarget: (target: THREE.WebGLRenderTarget | null) => targets.push(target),
    } as unknown as THREE.WebGLRenderer;
    const renderQuad = vi.spyOn(pass.quad, "render").mockImplementation(() => undefined);

    pass.setSize(1000, 600);
    pass.render(renderer, writeBuffer, readBuffer, 1 / 60, false);

    expect(pass.material.uniforms.tDiffuse).toBeUndefined();
    expect(pass.compositeMaterial.uniforms.tScene!.value).toBe(readBuffer.texture);
    expect(targets[0]).toBe(pass.renderTarget);
    expect(targets.at(-1)).toBe(writeBuffer);
    expect(renderQuad).toHaveBeenCalledTimes(3);
    readBuffer.dispose();
    writeBuffer.dispose();
    pass.dispose();
  });

  it("invalidates temporal history when depth changes and never reprojects without depth", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.low);
    const readBuffer = new THREE.WebGLRenderTarget(100, 60);
    const writeBuffer = new THREE.WebGLRenderTarget(100, 60);
    const renderer = {
      capabilities: { isWebGL2: true },
      setRenderTarget: () => undefined,
    } as unknown as THREE.WebGLRenderer;
    const temporalWeights: number[] = [];
    vi.spyOn(pass.quad, "render").mockImplementation(() => {
      const material = pass.quad.material as THREE.ShaderMaterial;
      if (material.uniforms.tHistory !== undefined) temporalWeights.push(material.uniforms.uHistoryValid!.value as number);
    });

    pass.setDepthTexture(new THREE.DepthTexture(100, 60));
    pass.render(renderer, writeBuffer, readBuffer, 1 / 60, false);
    pass.render(renderer, writeBuffer, readBuffer, 1 / 60, false);
    pass.setDepthTexture(null);
    pass.render(renderer, writeBuffer, readBuffer, 1 / 60, false);

    expect(temporalWeights).toEqual([0, 1, 0]);
    readBuffer.dispose();
    writeBuffer.dispose();
    pass.dispose();
  });

  it("retains history when identical depth, normal, and camera identities are rebound", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.low);
    const depth = new THREE.DepthTexture(100, 60);
    const normal = new THREE.Texture();
    const camera = new THREE.PerspectiveCamera();
    const invalidate = vi.spyOn(pass, "invalidateHistory");
    pass.setDepthTexture(depth); pass.setNormalTexture(normal); pass.setCamera(camera);
    expect(invalidate).toHaveBeenCalledTimes(3);
    pass.setDepthTexture(depth); pass.setNormalTexture(normal); pass.setCamera(camera);
    expect(invalidate).toHaveBeenCalledTimes(3);
    pass.setCamera(new THREE.PerspectiveCamera());
    expect(invalidate).toHaveBeenCalledTimes(4);
    depth.dispose(); normal.dispose(); pass.dispose();
  });
});
