import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { ParticleSimulation, type ComputeFactory, type ComputeVariable } from "./ParticleSimulation";

type FakeCompute = {
  computeCalls: number;
  disposed: number;
  dependencies: Map<string, string[]>;
  renderTargetDisposals: number;
  textureIndex: number;
  textures: [THREE.Texture, THREE.Texture];
  variables: ComputeVariable[];
};

function makeFactory(created: FakeCompute[]): ComputeFactory {
  return () => {
    const fake: FakeCompute = {
      computeCalls: 0, disposed: 0, dependencies: new Map(), renderTargetDisposals: 0, textureIndex: 0,
      textures: [new THREE.Texture(), new THREE.Texture()], variables: [],
    };
    created.push(fake);
    return {
      addVariable: (name, _shader, texture) => {
        const variable: ComputeVariable = { name, material: { uniforms: {} }, initialValueTexture: texture };
        fake.variables.push(variable);
        return variable;
      },
      setVariableDependencies: (variable, dependencies) => fake.dependencies.set(variable.name, dependencies.map(({ name }) => name)),
      init: () => null,
      compute: () => { fake.computeCalls += 1; fake.textureIndex = 1 - fake.textureIndex; },
      getCurrentRenderTarget: () => ({ texture: fake.textures[fake.textureIndex]! }),
      dispose: () => {
        fake.disposed += 1;
        fake.renderTargetDisposals += fake.variables.length * 2;
        for (const variable of fake.variables) variable.initialValueTexture.dispose();
      },
    };
  };
}

function frame(overrides: Partial<InteractionSnapshot> = {}): FrameContext {
  return {
    deltaSeconds: 1 / 60,
    elapsedSeconds: 2,
    interaction: {
      pointerNdc: [0, 0], pointerWorld: [1, 2, 3], pointerVelocity: [0, 0], gravity: 0.8,
      orbitDelta: [0, 0], zoomDelta: 0, pulseId: 1, pulseEnergy: 0.6, release: false,
      resetRequested: false, reducedMotion: false, ...overrides,
    },
  };
}

describe("ParticleSimulation", () => {
  it("installs ping-pong dependencies, updates interaction uniforms, and rebinds the computed position texture", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    simulation.update(frame());

    const compute = created[0]!;
    const velocity = compute.variables.find((variable) => variable.name === "textureVelocity")!;
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(compute.computeCalls).toBe(1);
    expect(compute.dependencies.get("texturePosition")).toEqual(["texturePosition", "textureVelocity"]);
    expect(compute.dependencies.get("textureVelocity")).toEqual(["texturePosition", "textureVelocity"]);
    expect(velocity.material.uniforms.uDelta!.value).toBe(1 / 60);
    expect(velocity.material.uniforms.uPointerPosition!.value).toEqual(new THREE.Vector3(1, 2, 3));
    expect(velocity.material.uniforms.uPointerGravity!.value).toBe(0.8);
    expect(velocity.material.uniforms.uPulseEnergy!.value).toBe(0.6);
    expect(points.material.uniforms.texturePosition!.value).toBe(compute.textures[1]);
  });

  it("creates drawable GPU points with a finite draw range and no frustum culling", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

    expect(points.geometry.getAttribute("position").count).toBe(128 * 128);
    expect(points.geometry.drawRange).toEqual({ start: 0, count: 128 * 128 });
    expect(points.frustumCulled).toBe(false);
  });

  it("keeps an active transition when asked for its incoming target and cancels it when asked for the outgoing target", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    simulation.setQuality(QUALITY_PROFILES.medium);
    simulation.setQuality(QUALITY_PROFILES.medium);

    expect(created).toHaveLength(2);
    expect(created[1]!.disposed).toBe(0);
    expect(simulation.object.children).toHaveLength(2);

    simulation.setQuality(QUALITY_PROFILES.low);

    expect(created).toHaveLength(2);
    expect(created[1]!.disposed).toBe(1);
    expect(simulation.object.children).toHaveLength(1);
  });

  it("crossfades a replacement for exactly 27 fixed 60 Hz steps", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    simulation.setQuality(QUALITY_PROFILES.medium);

    for (let step = 0; step < 27; step += 1) simulation.update(frame());

    expect(created[0]!.computeCalls).toBe(27);
    expect(created[1]!.computeCalls).toBe(27);
    expect(created[0]!.disposed).toBe(1);
    expect(simulation.object.children).toHaveLength(1);
  });

  it("disposes compute-owned textures and render targets plus point geometry/material exactly once", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    const energy = points.material.uniforms.uEnergyTexture!.value as THREE.Texture;
    const geometryDispose = vi.spyOn(points.geometry, "dispose");
    const materialDispose = vi.spyOn(points.material, "dispose");
    const energyDispose = vi.spyOn(energy, "dispose");

    simulation.dispose();
    simulation.dispose();

    expect(created[0]!.disposed).toBe(1);
    expect(created[0]!.renderTargetDisposals).toBe(4);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(energyDispose).toHaveBeenCalledTimes(1);
    expect(simulation.object.children).toHaveLength(0);
  });
});
