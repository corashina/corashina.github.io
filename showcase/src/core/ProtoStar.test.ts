import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import { describe, expect, it, vi } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { getProtoStarShaderUniforms } from "./protoStarMaterial";
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

    for (let step = 0; step < 27; step += 1) star.update(frame());

    const survivor = star.object.children[0] as MarchingCubes;
    expect(star.object.children).toHaveLength(1);
    expect(survivor.material).not.toBe(outgoing.material);
    expect((survivor.material as THREE.MeshPhysicalMaterial).transparent).toBe(false);
    expect((survivor.material as THREE.MeshPhysicalMaterial).opacity).toBe(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
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
});
