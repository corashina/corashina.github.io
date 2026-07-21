import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { applyMetaballs, sampleMetaballs } from "./coreField";
import { createProtoStarMaterial, setProtoStarMaterialState } from "./protoStarMaterial";

type Runtime = {
  effect: MarchingCubes;
  material: THREE.MeshPhysicalMaterial;
  resolution: QualityProfile["marchingCubes"];
  disposed: boolean;
};

type Transition = {
  outgoing: Runtime;
  incoming: Runtime;
  elapsed: number;
};

const TRANSITION_DURATION = 0.45;

function fieldInterval(resolution: QualityProfile["marchingCubes"]): number {
  if (resolution === 32) return 1 / 20;
  if (resolution === 40) return 1 / 30;
  return 1 / 60;
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** A physical, pulsating Marching Cubes proto-star with quality-aware replacement. */
export class ProtoStar {
  readonly object = new THREE.Group();
  private current: Runtime;
  private transition: Transition | null = null;
  private disposed = false;
  private fieldAccumulator = 0;
  private elapsed = 0;
  private energy = 0;
  private release = false;
  private profile: QualityProfile;

  constructor(profile: QualityProfile) {
    this.profile = profile;
    this.current = this.createRuntime(profile);
    this.object.add(this.current.effect);
  }

  update(frame: FrameContext): void {
    if (this.disposed) return;

    this.elapsed = frame.elapsedSeconds;
    this.energy = clampUnit(frame.interaction.pulseEnergy);
    this.release = frame.interaction.release;
    this.setRuntimeState(this.current);
    if (this.transition !== null) this.setRuntimeState(this.transition.incoming);

    this.fieldAccumulator += Math.max(0, frame.deltaSeconds);
    const interval = fieldInterval(this.profile.marchingCubes);
    while (this.fieldAccumulator + 1e-9 >= interval) {
      this.fieldAccumulator -= interval;
      this.applyField(this.current);
      if (this.transition !== null) this.applyField(this.transition.incoming);
    }

    if (this.transition === null) return;

    this.transition.elapsed += Math.max(0, frame.deltaSeconds);
    const progress = Math.min(1, this.transition.elapsed / TRANSITION_DURATION);
    this.setTransitionOpacity(this.transition.outgoing, 1 - progress);
    this.setTransitionOpacity(this.transition.incoming, progress);

    if (this.transition.elapsed >= TRANSITION_DURATION - 1e-9) {
      const completed = this.transition;
      this.object.remove(completed.outgoing.effect);
      this.disposeRuntime(completed.outgoing);
      this.restoreOpaque(completed.incoming);
      this.current = completed.incoming;
      this.transition = null;
    }
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed) return;

    if (this.transition !== null) {
      if (profile.marchingCubes === this.transition.incoming.resolution) return;
      if (profile.marchingCubes === this.transition.outgoing.resolution) {
        this.object.remove(this.transition.incoming.effect);
        this.disposeRuntime(this.transition.incoming);
        this.restoreOpaque(this.transition.outgoing);
        this.current = this.transition.outgoing;
        this.transition = null;
        this.profile = profile;
        return;
      }

      this.object.remove(this.transition.incoming.effect);
      this.disposeRuntime(this.transition.incoming);
      this.restoreOpaque(this.transition.outgoing);
      this.current = this.transition.outgoing;
      this.transition = null;
    }

    this.profile = profile;
    this.fieldAccumulator = 0;
    if (profile.marchingCubes === this.current.resolution) return;

    const incoming = this.createRuntime(profile);
    incoming.effect.position.copy(this.current.effect.position);
    incoming.effect.quaternion.copy(this.current.effect.quaternion);
    incoming.effect.scale.copy(this.current.effect.scale);
    this.setRuntimeState(incoming);
    this.applyField(incoming);
    this.setTransitionOpacity(incoming, 0);
    this.setTransitionOpacity(this.current, 1);
    this.object.add(incoming.effect);
    this.transition = { outgoing: this.current, incoming, elapsed: 0 };
  }

  getShadowMaterials(): THREE.MeshPhysicalMaterial[] {
    if (this.transition === null) return [this.current.material];
    return [this.transition.outgoing.material, this.transition.incoming.material];
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.transition !== null) {
      this.disposeRuntime(this.transition.incoming);
      this.transition = null;
    }
    this.disposeRuntime(this.current);
    this.object.clear();
  }

  private createRuntime(profile: QualityProfile): Runtime {
    const material = createProtoStarMaterial();
    const effect = new MarchingCubes(profile.marchingCubes, material, false, true, 120000);
    effect.castShadow = true;
    effect.receiveShadow = true;
    effect.frustumCulled = false;
    effect.userData.renderChannels = ["energy", "roughness"];
    const runtime = { effect, material, resolution: profile.marchingCubes, disposed: false };
    this.setRuntimeState(runtime);
    this.applyField(runtime);
    return runtime;
  }

  private setRuntimeState(runtime: Runtime): void {
    setProtoStarMaterialState(runtime.material, this.elapsed, this.energy, this.release);
    runtime.effect.userData.energy = this.energy;
    runtime.effect.userData.roughness = runtime.material.roughness;
  }

  private applyField(runtime: Runtime): void {
    applyMetaballs(runtime.effect, sampleMetaballs(this.elapsed, this.energy, this.release));
    runtime.effect.geometry.computeBoundingSphere();
  }

  private setTransitionOpacity(runtime: Runtime, opacity: number): void {
    runtime.material.transparent = true;
    runtime.material.depthWrite = false;
    runtime.material.opacity = opacity;
    runtime.material.needsUpdate = true;
  }

  private restoreOpaque(runtime: Runtime): void {
    runtime.material.opacity = 1;
    runtime.material.transparent = false;
    runtime.material.depthWrite = true;
    runtime.material.needsUpdate = true;
  }

  private disposeRuntime(runtime: Runtime): void {
    if (runtime.disposed) return;
    runtime.disposed = true;
    runtime.effect.geometry.dispose();
    runtime.material.dispose();
  }
}
