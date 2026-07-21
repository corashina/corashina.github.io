import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { createProtoStarMaterial, getProtoStarShaderUniforms } from "./protoStarMaterial";
import { ProtoStar } from "./ProtoStar";

function frame(overrides: Partial<InteractionSnapshot> = {}): FrameContext {
  return {
    deltaSeconds: 1 / 60,
    elapsedSeconds: 2,
    interaction: {
      pointerNdc: [0, 0], pointerWorld: [0, 0, 0], pointerVelocity: [0, 0], gravity: 0,
      orbitDelta: [0, 0], zoomDelta: 0, pulseId: 0, pulseEnergy: 0, release: false,
      resetRequested: false, reducedMotion: false, ...overrides,
    },
  };
}

describe("ProtoStar", () => {
  it.each([
    [QUALITY_PROFILES.ultra, 6],
    [QUALITY_PROFILES.high, 6],
    [QUALITY_PROFILES.medium, 3],
    [QUALITY_PROFILES.low, 2],
  ] as const)("updates its field at the %s profile cadence", (profile, expectedUpdates) => {
    const star = new ProtoStar(profile);
    const effect = star.object.children[0] as MarchingCubes;
    const updateSpy = vi.spyOn(effect, "update");

    for (let index = 0; index < 6; index += 1) star.update(frame());

    expect(updateSpy).toHaveBeenCalledTimes(expectedUpdates);
    star.dispose();
  });

  it("propagates pulse state into the physical material and render channels", () => {
    const star = new ProtoStar(QUALITY_PROFILES.low);

    star.update(frame({ pulseEnergy: 0.75, release: true }));

    const material = star.getShadowMaterials()[0]!;
    const effect = star.object.children[0] as MarchingCubes;
    expect(getProtoStarShaderUniforms(material)).toMatchObject({ uEnergy: { value: 0.75 }, uRelease: { value: 1 } });
    expect(effect.userData.renderChannels).toEqual(["energy", "roughness"]);
    expect(effect.userData.energy).toBe(0.75);
    expect(effect.userData.roughness).toBe(material.roughness);
    expect(star.getShadowMaterials()).toEqual([material]);
    star.dispose();
  });

  it("assigns deformation-aligned depth and distance materials with shared live uniforms", () => {
    const star = new ProtoStar(QUALITY_PROFILES.low);
    const effect = star.object.children[0] as MarchingCubes;
    const depth = effect.customDepthMaterial as THREE.MeshDepthMaterial;
    const distance = effect.customDistanceMaterial as THREE.MeshDistanceMaterial;
    expect(depth).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(distance).toBeInstanceOf(THREE.MeshDistanceMaterial);
    const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.depth.vertexShader, fragmentShader: THREE.ShaderLib.depth.fragmentShader } as THREE.WebGLProgramParametersWithUniforms;
    depth.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    const distanceShader = { uniforms: {}, vertexShader: THREE.ShaderLib.distance.vertexShader, fragmentShader: THREE.ShaderLib.distance.fragmentShader } as THREE.WebGLProgramParametersWithUniforms;
    distance.onBeforeCompile(distanceShader, {} as THREE.WebGLRenderer);
    expect(shader.uniforms.uTime).toBe(getProtoStarShaderUniforms(effect.material as THREE.MeshPhysicalMaterial).uTime);
    expect(shader.vertexShader).toContain("protoStarNoise");
    expect(distanceShader.vertexShader).toContain("protoStarNoise");
    expect(shader.fragmentShader).not.toContain("protoStarFresnel");
    expect(distanceShader.fragmentShader).not.toContain("protoStarFresnel");
    const depthDispose = vi.spyOn(depth, "dispose"); const distanceDispose = vi.spyOn(distance, "dispose");
    star.dispose();
    expect(depthDispose).toHaveBeenCalledTimes(1); expect(distanceDispose).toHaveBeenCalledTimes(1);
  });

  it("crossfades a replacement for 0.45 seconds, retains its transform, and disposes replaced resources", () => {
    const star = new ProtoStar(QUALITY_PROFILES.low);
    const outgoing = star.object.children[0] as MarchingCubes;
    outgoing.position.set(1, 2, 3);
    const geometryDispose = vi.spyOn(outgoing.geometry, "dispose");
    const materialDispose = vi.spyOn(outgoing.material as THREE.Material, "dispose");

    star.setQuality(QUALITY_PROFILES.medium);

    const incoming = star.object.children[1] as MarchingCubes;
    expect(star.object.children).toHaveLength(2);
    expect(incoming.position).toEqual(new THREE.Vector3(1, 2, 3));
    expect((outgoing.material as THREE.MeshPhysicalMaterial).transparent).toBe(true);
    expect((incoming.material as THREE.MeshPhysicalMaterial).transparent).toBe(true);
    expect((incoming.material as THREE.MeshPhysicalMaterial).opacity).toBe(0);
    expect(star.getShadowMaterials()).toHaveLength(2);
    expect(outgoing.userData.auxTransition).toEqual({ role: "outgoing", progress: 0 });
    expect(incoming.userData.auxTransition).toEqual({ role: "incoming", progress: 0 });

    for (let step = 0; step < 13; step += 1) star.update(frame());
    const outgoingTransition = outgoing.userData.auxTransition as { role: string; progress: number };
    const incomingTransition = incoming.userData.auxTransition as { role: string; progress: number };
    expect(outgoingTransition.role).toBe("outgoing"); expect(incomingTransition.role).toBe("incoming");
    expect(outgoingTransition.progress).toBeCloseTo(incomingTransition.progress);

    for (let step = 13; step < 27; step += 1) star.update(frame());

    const survivor = star.object.children[0] as MarchingCubes;
    expect(star.object.children).toHaveLength(1);
    expect(survivor.material).not.toBe(outgoing.material);
    expect((survivor.material as THREE.MeshPhysicalMaterial).transparent).toBe(false);
    expect((survivor.material as THREE.MeshPhysicalMaterial).opacity).toBe(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(survivor.userData.auxTransition).toBeUndefined();
    star.dispose();
  });

  it("disposes active resources exactly once even when disposal is repeated", () => {
    const star = new ProtoStar(QUALITY_PROFILES.low);
    const active = star.object.children[0] as MarchingCubes;
    const geometryDispose = vi.spyOn(active.geometry, "dispose");
    const materialDispose = vi.spyOn(active.material as THREE.Material, "dispose");

    star.dispose();
    star.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(star.object.children).toHaveLength(0);
  });

  it("rethrows material creation failures before attempting to create a marching effect", () => {
    const cause = new Error("material creation failed");
    const createEffect = vi.fn();

    expect(() => new ProtoStar(QUALITY_PROFILES.low, {
      createMaterial: () => { throw cause; },
      createEffect,
    })).toThrow(cause);

    expect(createEffect).not.toHaveBeenCalled();
  });

  it("disposes an already-created material when the marching effect factory fails", () => {
    const material = createProtoStarMaterial();
    const materialDispose = vi.spyOn(material, "dispose");
    const cause = new Error("marching effect creation failed");

    expect(() => new ProtoStar(QUALITY_PROFILES.low, {
      createMaterial: () => material,
      createEffect: () => { throw cause; },
    })).toThrow(cause);

    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("disposes the initial effect and material when its first bounds update fails", () => {
    const material = createProtoStarMaterial();
    const effect = new MarchingCubes(QUALITY_PROFILES.low.marchingCubes, material, false, true, 120000);
    const geometryDispose = vi.spyOn(effect.geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const cause = new Error("bounds failed");
    vi.spyOn(effect.geometry, "computeBoundingSphere").mockImplementation(() => { throw cause; });

    expect(() => new ProtoStar(QUALITY_PROFILES.low, {
      createMaterial: () => material,
      createEffect: () => effect,
    })).toThrow(cause);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it("leaves the active runtime intact when a quality replacement cannot be created", () => {
    let attempts = 0;
    const star = new ProtoStar(QUALITY_PROFILES.low, {
      createEffect: (resolution, material) => {
        attempts += 1;
        if (attempts === 2) throw new Error("quality replacement failed");
        return new MarchingCubes(resolution, material, false, true, 120000);
      },
    });
    const active = star.object.children[0] as MarchingCubes;
    const activeUpdate = vi.spyOn(active, "update");

    expect(() => star.setQuality(QUALITY_PROFILES.medium)).toThrow("quality replacement failed");
    for (let index = 0; index < 3; index += 1) star.update(frame());

    expect(star.object.children).toEqual([active]);
    expect(star.getShadowMaterials()).toEqual([active.material]);
    expect(activeUpdate).toHaveBeenCalledTimes(1);
    star.dispose();
  });

  it("initializes incoming effects once and preserves an active transition when a retarget creation fails", () => {
    const effects: MarchingCubes[] = [];
    const materials: THREE.MeshPhysicalMaterial[] = [];
    const cause = new Error("retarget creation failed");
    let incomingUpdate: ReturnType<typeof vi.spyOn> | undefined;
    let failedGeometryDispose: ReturnType<typeof vi.spyOn> | undefined;
    let failedMaterialDispose: ReturnType<typeof vi.spyOn> | undefined;
    const star = new ProtoStar(QUALITY_PROFILES.low, {
      createEffect: (resolution, material) => {
        const effect = new MarchingCubes(resolution, material, false, true, 120000);
        effects.push(effect);
        materials.push(material);
        if (effects.length === 2) incomingUpdate = vi.spyOn(effect, "update");
        if (effects.length === 3) {
          failedGeometryDispose = vi.spyOn(effect.geometry, "dispose");
          failedMaterialDispose = vi.spyOn(material, "dispose");
          vi.spyOn(effect, "update").mockImplementation(() => { throw cause; });
        }
        return effect;
      },
    });
    const outgoing = effects[0]!;

    star.setQuality(QUALITY_PROFILES.medium);

    const incoming = effects[1]!;
    const outgoingUpdate = vi.spyOn(outgoing, "update");
    expect(incomingUpdate).toHaveBeenCalledTimes(1);
    outgoingUpdate.mockClear();
    incomingUpdate!.mockClear();

    expect(() => star.setQuality(QUALITY_PROFILES.high)).toThrow(cause);

    expect(star.object.children).toEqual([outgoing, incoming]);
    expect(star.getShadowMaterials()).toEqual([outgoing.material, incoming.material]);
    expect(failedGeometryDispose).toHaveBeenCalledTimes(1);
    expect(failedMaterialDispose).toHaveBeenCalledTimes(1);

    star.update(frame());
    star.update(frame());
    expect(outgoingUpdate).toHaveBeenCalledTimes(1);
    expect(incomingUpdate).toHaveBeenCalledTimes(1);

    star.dispose();
    expect(failedGeometryDispose).toHaveBeenCalledTimes(1);
    expect(failedMaterialDispose).toHaveBeenCalledTimes(1);
  });
});
