import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { SpaceMembrane, type MembraneComputeFactory, type MembraneComputeVariable } from "./SpaceMembrane";
import { getMembraneShaderUniforms } from "./membraneShaders";

type FakeCompute = {
  computeCalls: number;
  dependencies: Map<string, string[]>;
  disposed: number;
  seedDisposals: number;
  textureIndex: number;
  textures: [THREE.Texture, THREE.Texture];
  variables: MembraneComputeVariable[];
};

function makeFactory(created: FakeCompute[], initError: string | null = null): MembraneComputeFactory {
  return () => {
    const fake: FakeCompute = {
      computeCalls: 0,
      dependencies: new Map(),
      disposed: 0,
      seedDisposals: 0,
      textureIndex: 0,
      textures: [new THREE.Texture(), new THREE.Texture()],
      variables: [],
    };
    created.push(fake);
    return {
      addVariable: (name, _shader, texture) => {
        const variable: MembraneComputeVariable = { name, material: { uniforms: {} }, initialValueTexture: texture };
        texture.addEventListener("dispose", () => { fake.seedDisposals += 1; });
        fake.variables.push(variable);
        return variable;
      },
      setVariableDependencies: (variable, dependencies) => fake.dependencies.set(variable.name, dependencies.map(({ name }) => name)),
      init: () => initError,
      compute: () => { fake.computeCalls += 1; fake.textureIndex = 1 - fake.textureIndex; },
      getCurrentRenderTarget: () => ({ texture: fake.textures[fake.textureIndex]! }),
      dispose: () => { fake.disposed += 1; for (const variable of fake.variables) variable.initialValueTexture.dispose(); },
    };
  };
}

function frame(overrides: Partial<InteractionSnapshot> = {}): FrameContext {
  return {
    deltaSeconds: 1 / 60,
    elapsedSeconds: 2,
    interaction: {
      pointerNdc: [0, 0], pointerWorld: [1, 0, 3], pointerVelocity: [0, 0], gravity: 0.8,
      orbitDelta: [0, 0], zoomDelta: 0, pulseId: 4, pulseEnergy: 0.6, release: false,
      resetRequested: false, reducedMotion: false, ...overrides,
    },
  };
}

describe("SpaceMembrane", () => {
  it("builds a finite drawable physical mesh and advances its GPU height state from interaction and particle texture", () => {
    const created: FakeCompute[] = [];
    const membrane = new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    membrane.object.position.y = -2.2;
    const particles = new THREE.Texture();
    membrane.update(frame(), particles);

    const compute = created[0]!;
    const variable = compute.variables[0]!;
    const mesh = membrane.object.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
    const renderUniforms = getMembraneShaderUniforms(mesh.material);
    expect(compute.computeCalls).toBe(1);
    expect(compute.dependencies.get("textureHeight")).toEqual(["textureHeight"]);
    expect(mesh.geometry.getAttribute("position").count).toBe(96 * 96);
    expect(mesh.geometry.drawRange).toEqual({ start: 0, count: mesh.geometry.index!.count });
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(mesh.userData.renderChannels).toEqual(["low-energy", "low-roughness"]);
    expect(renderUniforms.uWorldTexel.value).toBeCloseTo(16 / 95);
    expect(variable.material.uniforms.uDelta!.value).toBe(1 / 60);
    expect(variable.material.uniforms.uTime!.value).toBe(2);
    expect(variable.material.uniforms.uPointerUv!.value).toEqual(new THREE.Vector2(9 / 16, 11 / 16));
    expect(variable.material.uniforms.uPulseEnergy!.value).toBe(0.6);
    expect(variable.material.uniforms.uParticleTexture!.value).toBe(particles);
    expect(variable.material.uniforms.uMembraneY!.value).toBe(-2.2);
    expect(variable.material.uniforms.uParticleSamples!.value).toHaveLength(8);
    expect(renderUniforms.uHeightTexture.value).toBe(compute.textures[1]);
  });

  it("does not allocate an orphan particle placeholder before the first fixed step", () => {
    const created: FakeCompute[] = [];
    new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    expect(created[0]!.variables[0]!.material.uniforms.uParticleTexture!.value).toBeNull();
  });

  it("de-duplicates a pulse id while preserving pointer and particle simulation updates", () => {
    const created: FakeCompute[] = [];
    const membrane = new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    const particles = new THREE.Texture();
    membrane.update(frame(), particles);
    membrane.update(frame(), particles);
    const variable = created[0]!.variables[0]!;

    expect(created[0]!.computeCalls).toBe(2);
    expect(variable.material.uniforms.uPulseEnergy!.value).toBe(0);
    expect(variable.material.uniforms.uParticleTexture!.value).toBe(particles);
  });

  it("crossfades quality replacements for tolerant 27 fixed steps and cancels or retargets active transitions", () => {
    const created: FakeCompute[] = [];
    const membrane = new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    const particles = new THREE.Texture();
    const stableMaterial = membrane.getShadowMaterials()[0]!;
    expect(stableMaterial.transparent).toBe(false);
    expect(stableMaterial.depthWrite).toBe(true);

    membrane.setQuality(QUALITY_PROFILES.medium);
    membrane.setQuality(QUALITY_PROFILES.medium);
    expect(created).toHaveLength(2);
    expect(membrane.object.children).toHaveLength(2);
    expect(membrane.getShadowMaterials()).toHaveLength(2);
    for (const material of membrane.getShadowMaterials()) {
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
    }

    membrane.setQuality(QUALITY_PROFILES.low);
    expect(created[1]!.disposed).toBe(1);
    expect(membrane.object.children).toHaveLength(1);
    expect(stableMaterial.transparent).toBe(false);
    expect(stableMaterial.depthWrite).toBe(true);

    membrane.setQuality(QUALITY_PROFILES.high);
    membrane.setQuality(QUALITY_PROFILES.medium);
    expect(created).toHaveLength(4);
    expect(created[2]!.disposed).toBe(1);

    membrane.update(frame(), particles);
    expect(created[3]!.variables[0]!.material.uniforms.uPulseEnergy!.value).toBe(0.6);
    for (let step = 1; step < 27; step += 1) membrane.update(frame(), particles);
    expect(created[0]!.computeCalls).toBe(27);
    expect(created[3]!.computeCalls).toBe(27);
    expect(created[0]!.disposed).toBe(1);
    expect(membrane.object.children).toHaveLength(1);
    expect(membrane.getShadowMaterials()).toHaveLength(1);
    expect(membrane.getShadowMaterials()[0]!.transparent).toBe(false);
    expect(membrane.getShadowMaterials()[0]!.depthWrite).toBe(true);
    expect(membrane.getShadowMaterials()[0]!.opacity).toBe(1);
  });

  it("cleans up failed initialization and disposes every live resource only once", () => {
    const failed: FakeCompute[] = [];
    expect(() => new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(failed, "unsupported") })).toThrow("Membrane GPU computation could not initialize");
    expect(failed[0]!.disposed).toBe(1);
    expect(failed[0]!.seedDisposals).toBe(1);

    const created: FakeCompute[] = [];
    const membrane = new SpaceMembrane({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    const mesh = membrane.object.children[0] as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    const materialDispose = vi.spyOn(mesh.material, "dispose");
    membrane.dispose();
    membrane.dispose();

    expect(created[0]!.disposed).toBe(1);
    expect(created[0]!.seedDisposals).toBe(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(membrane.object.children).toHaveLength(0);
  });
});
