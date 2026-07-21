import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { applyMetaballs, sampleMetaballs } from "./coreField";
import { createProtoStarMaterial, setProtoStarMaterialState } from "./protoStarMaterial";
import { createDeformationShadowMaterials } from "../rendering/deformationShadowMaterials";

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

export type ProtoStarEffectFactory = (resolution: QualityProfile["marchingCubes"], material: THREE.MeshPhysicalMaterial) => MarchingCubes;

export type ProtoStarOptions = {
  createMaterial?: () => THREE.MeshPhysicalMaterial;
  createEffect?: ProtoStarEffectFactory;
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

function createMarchingCubes(
  resolution: QualityProfile["marchingCubes"],
  material: THREE.MeshPhysicalMaterial,
): MarchingCubes {
  return new MarchingCubes(resolution, material, false, true, 120000);
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
  private readonly materialFactory: () => THREE.MeshPhysicalMaterial;
  private readonly effectFactory: ProtoStarEffectFactory;

  constructor(profile: QualityProfile, options: ProtoStarOptions = {}) {
    this.profile = profile;
    this.materialFactory = options.createMaterial ?? createProtoStarMaterial;
    this.effectFactory = options.createEffect ?? createMarchingCubes;
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

      const replacement = this.createRuntime(profile);
      const previousTransition = this.transition;
      this.object.remove(previousTransition.incoming.effect);
      this.disposeRuntime(previousTransition.incoming);
      this.restoreOpaque(previousTransition.outgoing);
      this.current = previousTransition.outgoing;
      this.transition = null;
      this.beginTransition(profile, replacement);
      return;
    }

    if (profile.marchingCubes === this.current.resolution) {
      this.profile = profile;
      return;
    }

    const incoming = this.createRuntime(profile);
    this.beginTransition(profile, incoming);
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

  private beginTransition(profile: QualityProfile, incoming: Runtime): void {
    incoming.effect.position.copy(this.current.effect.position);
    incoming.effect.quaternion.copy(this.current.effect.quaternion);
    incoming.effect.scale.copy(this.current.effect.scale);
    this.setTransitionOpacity(incoming, 0);
    this.setTransitionOpacity(this.current, 1);
    this.object.add(incoming.effect);
    this.transition = { outgoing: this.current, incoming, elapsed: 0 };
    this.profile = profile;
    this.fieldAccumulator = 0;
  }

  private createRuntime(profile: QualityProfile): Runtime {
    let material: THREE.MeshPhysicalMaterial | null = null;
    let effect: MarchingCubes | null = null;
    try {
      material = this.materialFactory();
      effect = this.effectFactory(profile.marchingCubes, material);
      effect.castShadow = true;
      effect.receiveShadow = true;
      effect.frustumCulled = false;
      effect.userData.renderChannels = ["energy", "roughness"];
      const shadow = createDeformationShadowMaterials(material);
      effect.customDepthMaterial = shadow.depth;
      effect.customDistanceMaterial = shadow.distance;
      const runtime = { effect, material, resolution: profile.marchingCubes, disposed: false };
      this.setRuntimeState(runtime);
      this.applyField(runtime);
      return runtime;
    } catch (error) {
      effect?.customDepthMaterial?.dispose();
      effect?.customDistanceMaterial?.dispose();
      effect?.geometry.dispose();
      material?.dispose();
      throw error;
    }
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
    runtime.effect.customDepthMaterial?.dispose();
    runtime.effect.customDistanceMaterial?.dispose();
    runtime.material.dispose();
  }
}
