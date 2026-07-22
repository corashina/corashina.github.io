import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { PARTICLE_COUNT } from "./particleConfig";
import { ParticleSimulation, type ComputeFactory, type ComputeVariable } from "./ParticleSimulation";
import { particleVelocityShader } from "./particleShaders";

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
      orbitDelta: [0, 0], zoomDelta: 0, pulseId: 1, pulseCharge: 0.75, pulseEnergy: 0.6, pulseAge: 0.4, pulseRadius: 4.25, release: false,
      resetRequested: false, reducedMotion: false, ...overrides,
    },
  };
}

describe("ParticleSimulation", () => {
  it("installs ping-pong dependencies, updates interaction uniforms, and rebinds the computed position texture", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });

    simulation.update(frame());

    const compute = created[0]!;
    const velocity = compute.variables.find((variable) => variable.name === "textureVelocity")!;
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(compute.computeCalls).toBe(1);
    expect(compute.dependencies.get("texturePosition")).toEqual(["texturePosition", "textureVelocity"]);
    expect(compute.dependencies.get("textureVelocity")).toEqual(["texturePosition", "textureVelocity"]);
    expect(velocity.material.uniforms.uDelta!.value).toBe(3 / 60);
    expect(velocity.material.uniforms.uPointerPosition!.value).toEqual(new THREE.Vector3(1, 2, 3));
    expect(velocity.material.uniforms.uPointerGravity!.value).toBe(0.8);
    expect(velocity.material.uniforms.uPulseEnergy!.value).toBe(0.6);
    expect(velocity.material.uniforms.uPulseRadius!.value).toBe(4.25);
    expect(points.material.uniforms.texturePosition!.value).toBe(compute.textures[1]);
  });

  it("applies live speed, force, size, and pulse parameters", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
    simulation.setParameters({
      speed: 3, orbitStrength: 1.2, turbulence: 0.8, drag: 0.2,
      particleSize: 24, bloomStrength: 0.4, pulseStrength: 1.5,
    });
    simulation.update(frame({ pulseEnergy: 0.6 }));
    const variables = created[0]!.variables;
    const position = variables.find(({ name }) => name === "texturePosition")!;
    const velocity = variables.find(({ name }) => name === "textureVelocity")!;
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
    expect(position.material.uniforms.uDelta!.value).toBeCloseTo(3 / 60);
    expect(velocity.material.uniforms.uDelta!.value).toBeCloseTo(3 / 60);
    expect(velocity.material.uniforms.uOrbitStrength!.value).toBe(1.2);
    expect(velocity.material.uniforms.uTurbulence!.value).toBe(0.8);
    expect(velocity.material.uniforms.uDrag!.value).toBe(0.2);
    expect(velocity.material.uniforms.uPulseEnergy!.value).toBeCloseTo(0.9);
    expect(points.material.uniforms.uPointSize!.value).toBe(24);
  });

  it("creates drawable GPU points with a finite draw range and no frustum culling", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
    const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

    expect(points.geometry.getAttribute("position").count).toBe(PARTICLE_COUNT);
    expect(points.geometry.drawRange).toEqual({ start: 0, count: PARTICLE_COUNT });
    expect(points.frustumCulled).toBe(false);
    expect("setQuality" in simulation).toBe(false);
  });

  it("materially suppresses rapid ejection and turbulence for reduced motion", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
    simulation.update(frame({ reducedMotion: true, pulseEnergy: 1, pointerVelocity: [1, 0] }));
    const uniforms = created[0]!.variables.find(({ name }) => name === "textureVelocity")!.material.uniforms;
    expect(uniforms.uPulseEnergy!.value).toBeLessThanOrEqual(0.15);
    expect(uniforms.uOrbitStrength!.value).toBeLessThanOrEqual(0.2);
    expect(uniforms.uTurbulence!.value).toBe(0);
    expect(uniforms.uDrag!.value).toBeGreaterThanOrEqual(0.25);
    expect((uniforms.uPointerVelocity!.value as THREE.Vector2).length()).toBeLessThanOrEqual(0.2);
    simulation.dispose();
  });

  it("forwards bounded pointer velocity into a tangential compute force", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
    simulation.update(frame({ pointerVelocity: [8, -6] }));
    const uniforms = created[0]!.variables.find(({ name }) => name === "textureVelocity")!.material.uniforms;
    const velocity = uniforms.uPointerVelocity!.value as THREE.Vector2;
    expect(velocity.length()).toBeCloseTo(1);
    expect(particleVelocityShader).toContain("uniform vec2 uPointerVelocity");
    expect(particleVelocityShader).toContain("pointerTangential");
    simulation.dispose();
  });

  it("disposes compute-owned textures and render targets plus point geometry/material exactly once", () => {
    const created: FakeCompute[] = [];
    const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
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
