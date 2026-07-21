import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createProtoStarMaterial, setProtoStarMaterialState } from "./protoStarMaterial";

function uniformsFor(material: THREE.MeshPhysicalMaterial): Record<string, { value: unknown }> {
  const shader = {
    uniforms: {},
    vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <emissivemap_fragment>",
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader.uniforms;
}

describe("createProtoStarMaterial", () => {
  it("creates a physically lit transmissive crystal with stable plasma shader hooks", () => {
    const material = createProtoStarMaterial();
    const uniforms = uniformsFor(material);

    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.transmission).toBe(0.18);
    expect(material.thickness).toBe(1.4);
    expect(material.attenuationDistance).toBeGreaterThan(0);
    expect(material.ior).toBe(1.48);
    expect(material.dispersion).toBe(0.08);
    expect(material.clearcoat).toBe(0.65);
    expect(material.emissive.getStyle()).toBe("rgb(255,179,106)");
    expect(material.customProgramCacheKey()).toBe(material.customProgramCacheKey());
    expect(uniforms).toMatchObject({ uTime: { value: 0 }, uEnergy: { value: 0 }, uRelease: { value: 0 } });
  });

  it("declares every proto-star uniform in the realistic vertex shader stage that uses it", () => {
    const material = createProtoStarMaterial();
    const shader = {
      uniforms: {},
      vertexShader: "#define STANDARD\n#include <common>\nvoid main() {\n  #include <begin_vertex>\n}",
      fragmentShader: "#include <common>\n#include <emissivemap_fragment>",
    };

    material.onBeforeCompile(shader as never, {} as never);

    for (const uniform of ["uTime", "uEnergy", "uRelease"]) {
      expect(shader.vertexShader.match(new RegExp(`uniform\\s+float\\s+${uniform}\\s*;`, "g"))).toHaveLength(1);
      expect(shader.vertexShader.indexOf(`uniform float ${uniform};`)).toBeLessThan(shader.vertexShader.indexOf(`+ ${uniform}`));
    }
  });
});

describe("setProtoStarMaterialState", () => {
  it("keeps rest-state material controls within physical bounds", () => {
    const material = createProtoStarMaterial();
    const uniforms = uniformsFor(material);

    setProtoStarMaterialState(material, 1.5, 0, false);

    expect(material.roughness).toBeCloseTo(0.28);
    expect(material.transmission).toBeCloseTo(0.18);
    expect(material.emissiveIntensity).toBeGreaterThanOrEqual(0);
    expect(material.dispersion).toBeCloseTo(0.08);
    expect(uniforms.uTime!.value).toBe(1.5);
    expect(uniforms.uRelease!.value).toBe(0);
  });

  it("converges to the crystal limits at full pulse energy", () => {
    const material = createProtoStarMaterial();
    const uniforms = uniformsFor(material);

    setProtoStarMaterialState(material, 4, 1, true);

    expect(material.roughness).toBeCloseTo(0.08);
    expect(material.transmission).toBeCloseTo(0.92);
    expect(material.emissiveIntensity).toBeCloseTo(2.6);
    expect(material.dispersion).toBeCloseTo(0.68);
    expect(uniforms.uEnergy!.value).toBe(1);
    expect(uniforms.uRelease!.value).toBe(1);
  });
});
