import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applyPcss } from "./pcss";

describe("applyPcss", () => {
  it("chains a stable 32-tap PCSS augmentation for the high tier", () => {
    const material = new THREE.MeshPhysicalMaterial();
    const original = material.onBeforeCompile;
    applyPcss(material, "pcss-high");
    const shader = { fragmentShader: "#include <shadowmap_pars_fragment>", vertexShader: "", uniforms: {} } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(material.onBeforeCompile).not.toBe(original);
    expect(material.customProgramCacheKey()).toContain("pcss-high-32");
    expect(shader.fragmentShader).toContain("findBlocker");
    expect(shader.fragmentShader).toContain("penumbra");
    expect(shader.fragmentShader).toContain("PCSS_FILTER_TAPS 32");
  });

  it("uses 16 taps for medium and leaves PCF material programs untouched", () => {
    const medium = new THREE.MeshPhysicalMaterial();
    applyPcss(medium, "pcss-medium");
    const mediumShader = { fragmentShader: "#include <shadowmap_pars_fragment>", vertexShader: "", uniforms: {} } as THREE.WebGLProgramParametersWithUniforms;
    medium.onBeforeCompile(mediumShader, {} as THREE.WebGLRenderer);
    expect(mediumShader.fragmentShader).toContain("PCSS_FILTER_TAPS 16");

    const pcf = new THREE.MeshPhysicalMaterial();
    const callback = pcf.onBeforeCompile;
    const cacheKey = pcf.customProgramCacheKey();
    applyPcss(pcf, "pcf");
    expect(pcf.onBeforeCompile).toBe(callback);
    expect(pcf.customProgramCacheKey()).toBe(cacheKey);
  });
});
