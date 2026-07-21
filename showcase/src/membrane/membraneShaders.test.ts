import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  createMembraneMaterial,
  getMembraneShaderUniforms,
  membraneComputeShader,
} from "./membraneShaders";

describe("membrane compute shader", () => {
  it("propagates bounded height and velocity across four neighbours with pulse and particle impacts", () => {
    expect(membraneComputeShader).toContain("north");
    expect(membraneComputeShader).toContain("south");
    expect(membraneComputeShader).toContain("east");
    expect(membraneComputeShader).toContain("west");
    expect(membraneComputeShader).toContain("laplacian");
    expect(membraneComputeShader).toContain("uWaveSpeed");
    expect(membraneComputeShader).toContain("exp(-uDamping * uDelta)");
    expect(membraneComputeShader).toContain("pulse");
    expect(membraneComputeShader).toContain("clamp(center + velocity * uDelta + pulse + impacts, -0.65, 0.65)");
    expect(membraneComputeShader).toContain("gl_FragColor = vec4(height, velocity");
  });

  it("samples exactly eight fixed particle texture coordinates", () => {
    expect(membraneComputeShader).toContain("uParticleSamples[8]");
    expect((membraneComputeShader.match(/texture2D\(uParticleTexture, uParticleSamples\[/g) ?? [])).toHaveLength(8);
    expect(membraneComputeShader).toContain("particle.xz");
    expect(membraneComputeShader).toContain("abs(particle.y - uMembraneY)");
  });
});

describe("membrane physical material", () => {
  function compilePhysicalMaterial(material: THREE.MeshPhysicalMaterial): {
    uniforms: Record<string, { value: unknown }>;
    vertexShader: string;
    fragmentShader: string;
  } {
    const physical = THREE.ShaderLib.physical;
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: physical.vertexShader,
      fragmentShader: physical.fragmentShader,
    };
    material.onBeforeCompile(shader as never, {} as never);
    return shader;
  }

  it("augments a real physical environment- and shadow-lit material instead of replacing its lighting pipeline", () => {
    const heightTexture = new THREE.Texture();
    const material = createMembraneMaterial(96, 16, heightTexture);
    const shader = compilePhysicalMaterial(material);

    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.roughness).toBeCloseTo(0.12);
    expect(material.envMapIntensity).toBeGreaterThan(0);
    expect(material.customProgramCacheKey()).toBe(material.customProgramCacheKey());
    expect(shader.fragmentShader).toContain("#include <envmap_physical_pars_fragment>");
    expect(shader.fragmentShader).toContain("#include <shadowmap_pars_fragment>");
    expect(shader.fragmentShader).toContain("#include <lights_fragment_begin>");
    expect(shader.fragmentShader).toContain("#include <lights_fragment_end>");
    expect(shader.fragmentShader).toContain("reflectedLight.directDiffuse");
    expect(shader.fragmentShader).toContain("reflectedLight.indirectSpecular");
  });

  it("injects height displacement and finite-difference normals into the physical vertex stage", () => {
    const material = createMembraneMaterial(96, 16, new THREE.Texture());
    const shader = compilePhysicalMaterial(material);
    const mainStart = shader.vertexShader.indexOf("void main()");

    for (const declaration of [
      "uniform sampler2D uHeightTexture;",
      "uniform vec2 uTexel;",
      "uniform float uWorldTexel;",
      "uniform float uHeightScale;",
      "varying float vMembraneCurvature;",
      "varying vec3 vMembraneWorldPosition;",
    ]) {
      expect(shader.vertexShader.indexOf(declaration)).toBeGreaterThanOrEqual(0);
      expect(shader.vertexShader.indexOf(declaration)).toBeLessThan(mainStart);
    }
    expect(shader.vertexShader).toContain("heightEast");
    expect(shader.vertexShader).toContain("heightWest");
    expect(shader.vertexShader).toContain("heightNorth");
    expect(shader.vertexShader).toContain("heightSouth");
    expect(shader.vertexShader).toContain("objectNormal = normalize(cross");
    expect(shader.vertexShader).toContain("transformed += vec3(0.0, 0.0, membraneHeight)");
    expect(shader.vertexShader).toContain("2.0 * uWorldTexel");
  });

  it("adds fine procedural normal detail and cyan curvature/Fresnel response after physical normal and light setup", () => {
    const material = createMembraneMaterial(96, 16, new THREE.Texture());
    const shader = compilePhysicalMaterial(material);
    const mainStart = shader.fragmentShader.indexOf("void main()");
    const normalMaps = shader.fragmentShader.indexOf("#include <normal_fragment_maps>");
    const detail = shader.fragmentShader.indexOf("membraneFineDetail", normalMaps);
    const lightsEnd = shader.fragmentShader.indexOf("#include <lights_fragment_end>");
    const response = shader.fragmentShader.indexOf("membraneFresnel", lightsEnd);

    expect(shader.fragmentShader.indexOf("varying float vMembraneCurvature;")).toBeLessThan(mainStart);
    expect(shader.fragmentShader.indexOf("varying vec3 vMembraneWorldPosition;")).toBeLessThan(mainStart);
    expect(shader.fragmentShader).toContain("dFdx");
    expect(shader.fragmentShader).toContain("dFdy");
    expect(detail).toBeGreaterThan(normalMaps);
    expect(shader.fragmentShader).toContain("normal = membranePerturbNormal");
    expect(response).toBeGreaterThan(lightsEnd);
    expect(shader.fragmentShader).toContain("membraneCyan");
    expect(shader.fragmentShader).toContain("vMembraneCurvature");
    expect(shader.fragmentShader).toContain("material.diffuseContribution =");
    expect(shader.fragmentShader).toContain("outgoingLight +=");
  });

  it("shares live displacement uniforms with compiled physical programs", () => {
    const initial = new THREE.Texture();
    const replacement = new THREE.Texture();
    const material = createMembraneMaterial(128, 16, initial);
    const uniforms = getMembraneShaderUniforms(material);
    const shader = compilePhysicalMaterial(material);

    expect(shader.uniforms.uHeightTexture).toBe(uniforms.uHeightTexture);
    expect(uniforms.uHeightTexture.value).toBe(initial);
    expect(uniforms.uTexel.value).toEqual(new THREE.Vector2(1 / 128, 1 / 128));
    expect(uniforms.uWorldTexel.value).toBeCloseTo(16 / 127);
    uniforms.uHeightTexture.value = replacement;
    expect(shader.uniforms.uHeightTexture!.value).toBe(replacement);
  });
});
