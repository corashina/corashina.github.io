import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { ParticleSimulation, type ComputeFactory, type ComputeVariable } from "./ParticleSimulation";

type FakeCompute = {
  computeCalls: number;
  disposed: number;
  variables: ComputeVariable[];
};

function makeFactory(created: FakeCompute[]): ComputeFactory {
  return () => {
    const fake: FakeCompute = { computeCalls: 0, disposed: 0, variables: [] };
    created.push(fake);
    return {
      addVariable: (name, _shader, texture) => {
        const variable: ComputeVariable = { name, material: { uniforms: {} }, initialValueTexture: texture };
        fake.variables.push(variable);
        return variable;
      },
      setVariableDependencies: () => undefined,
      init: () => null,
      compute: () => { fake.computeCalls += 1; },
      getCurrentRenderTarget: (variable) => ({ texture: variable.initialValueTexture }),
      dispose: () => { fake.disposed += 1; },
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
  it("computes once per fixed update and publishes interaction uniforms", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    simulation.update(frame());

    const velocity = created[0]!.variables.find((variable) => variable.name === "textureVelocity")!;
    expect(created[0]!.computeCalls).toBe(1);
    expect(velocity.material.uniforms.uDelta!.value).toBe(1 / 60);
    expect(velocity.material.uniforms.uPointerPosition!.value).toEqual(new THREE.Vector3(1, 2, 3));
    expect(velocity.material.uniforms.uPointerGravity!.value).toBe(0.8);
    expect(velocity.material.uniforms.uPulseEnergy!.value).toBe(0.6);
    expect(simulation.getPositionTexture()).toBeTruthy();
  });

  it("crossfades a replacement while advancing both simulations", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    simulation.setQuality(QUALITY_PROFILES.medium);
    simulation.update({ ...frame(), deltaSeconds: 0.2 });

    expect(created).toHaveLength(2);
    expect(created[0]!.computeCalls).toBe(1);
    expect(created[1]!.computeCalls).toBe(1);
    expect(simulation.object.children).toHaveLength(2);

    simulation.update({ ...frame(), deltaSeconds: 0.3 });

    expect(created[0]!.disposed).toBe(1);
    expect(simulation.object.children).toHaveLength(1);
  });

  it("disposes compute resources and particle materials exactly once", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, QUALITY_PROFILES.low, { computeFactory: makeFactory(created) });

    simulation.dispose();
    simulation.dispose();

    expect(created[0]!.disposed).toBe(1);
    expect(simulation.object.children).toHaveLength(0);
  });
});
