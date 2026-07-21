import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { createMembraneMaterial, getMembraneShaderUniforms, membraneComputeShader } from "./membraneShaders";
import { createDeformationShadowMaterials } from "../rendering/deformationShadowMaterials";

type Uniform = { value: unknown };

export type MembraneComputeVariable = {
  name: string;
  material: { uniforms: Record<string, Uniform> };
  initialValueTexture: THREE.Texture;
};

export type MembraneComputeRenderer = {
  addVariable(name: string, shader: string, texture: THREE.Texture): MembraneComputeVariable;
  setVariableDependencies(variable: MembraneComputeVariable, dependencies: MembraneComputeVariable[]): void;
  init(): string | null;
  compute(): void;
  getCurrentRenderTarget(variable: MembraneComputeVariable): { texture: THREE.Texture };
  dispose(): void;
};

export type MembraneComputeFactory = (size: number, renderer: THREE.WebGLRenderer) => MembraneComputeRenderer;

export type SpaceMembraneOptions = { computeFactory?: MembraneComputeFactory };

type Runtime = {
  compute: MembraneComputeRenderer;
  height: MembraneComputeVariable;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial>;
  resolution: QualityProfile["membrane"];
  disposed: boolean;
};

type Transition = { outgoing: Runtime; incoming: Runtime; elapsed: number };

const TRANSITION_DURATION = 0.45;
const MEMBRANE_SIZE = 16;
const PARTICLE_SAMPLES = [
  [0.125, 0.125], [0.375, 0.125], [0.625, 0.125], [0.875, 0.125],
  [0.125, 0.875], [0.375, 0.875], [0.625, 0.875], [0.875, 0.875],
] as const;

function createGpuCompute(size: number, renderer: THREE.WebGLRenderer): MembraneComputeRenderer {
  return new GPUComputationRenderer(size, size, renderer) as unknown as MembraneComputeRenderer;
}

function setUniform(variable: MembraneComputeVariable, name: string, value: unknown): void {
  variable.material.uniforms[name] = { value };
}

function createHeightSeed(size: number): THREE.DataTexture {
  const data = new Float32Array(size * size * 4);
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}

/** A height-field membrane simulated by a GPU ping-pong texture. */
export class SpaceMembrane {
  readonly object = new THREE.Group();
  private readonly computeFactory: MembraneComputeFactory;
  private current: Runtime;
  private transition: Transition | null = null;
  private disposed = false;
  private lastPulseId = -1;
  private readonly worldPosition = new THREE.Vector3();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    profile: QualityProfile,
    options: SpaceMembraneOptions = {},
  ) {
    this.computeFactory = options.computeFactory ?? createGpuCompute;
    this.current = this.createRuntime(profile);
    this.object.add(this.current.mesh);
  }

  update(frame: FrameContext, particleTexture: THREE.Texture): void {
    if (this.disposed) return;
    const pulseEnergy = frame.interaction.pulseId === this.lastPulseId ? 0 : Math.max(0, frame.interaction.pulseEnergy);
    this.object.getWorldPosition(this.worldPosition);
    this.advanceRuntime(this.current, frame, particleTexture, pulseEnergy, this.worldPosition.y);
    if (this.transition === null) {
      this.lastPulseId = frame.interaction.pulseId;
      return;
    }

    this.advanceRuntime(this.transition.incoming, frame, particleTexture, pulseEnergy, this.worldPosition.y);
    this.lastPulseId = frame.interaction.pulseId;
    this.transition.elapsed += Math.max(0, frame.deltaSeconds);
    const progress = Math.min(1, this.transition.elapsed / TRANSITION_DURATION);
    this.setTransitionOpacity(this.transition.outgoing, 1 - progress);
    this.setTransitionOpacity(this.transition.incoming, progress);
    if (this.transition.elapsed >= TRANSITION_DURATION - 1e-9) {
      const completed = this.transition;
      this.object.remove(completed.outgoing.mesh);
      this.disposeRuntime(completed.outgoing);
      this.restoreOpaque(completed.incoming);
      this.current = completed.incoming;
      this.transition = null;
    }
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed) return;
    if (this.transition !== null) {
      if (profile.membrane === this.transition.incoming.resolution) return;
      if (profile.membrane === this.transition.outgoing.resolution) {
        this.object.remove(this.transition.incoming.mesh);
        this.disposeRuntime(this.transition.incoming);
        this.restoreOpaque(this.transition.outgoing);
        this.current = this.transition.outgoing;
        this.transition = null;
        return;
      }
      const outgoing = this.transition.outgoing;
      this.object.remove(this.transition.incoming.mesh);
      this.disposeRuntime(this.transition.incoming);
      this.restoreOpaque(outgoing);
      this.current = outgoing;
      this.transition = null;
    }
    if (profile.membrane === this.current.resolution) return;
    const incoming = this.createRuntime(profile);
    this.setTransitionOpacity(this.current, 1);
    this.setTransitionOpacity(incoming, 0);
    this.object.add(incoming.mesh);
    this.transition = { outgoing: this.current, incoming, elapsed: 0 };
  }

  getShadowMaterials(): THREE.MeshPhysicalMaterial[] {
    if (this.transition === null) return [this.current.mesh.material];
    return [this.transition.outgoing.mesh.material, this.transition.incoming.mesh.material];
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
    const resolution = profile.membrane;
    const seed = createHeightSeed(resolution);
    let compute: MembraneComputeRenderer | null = null;
    let computeOwnsSeed = false;
    let geometry: THREE.PlaneGeometry | null = null;
    let material: THREE.MeshPhysicalMaterial | null = null;
    let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshPhysicalMaterial> | null = null;
    try {
      compute = this.computeFactory(resolution, this.renderer);
      const height = compute.addVariable("textureHeight", membraneComputeShader, seed);
      computeOwnsSeed = true;
      compute.setVariableDependencies(height, [height]);
      this.attachUniforms(height);
      const error = compute.init();
      if (error !== null) throw new Error(`Membrane GPU computation could not initialize: ${error}`);
      geometry = new THREE.PlaneGeometry(MEMBRANE_SIZE, MEMBRANE_SIZE, resolution - 1, resolution - 1);
      geometry.setDrawRange(0, geometry.index?.count ?? geometry.getAttribute("position").count);
      material = createMembraneMaterial(resolution, MEMBRANE_SIZE, compute.getCurrentRenderTarget(height).texture);
      mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      mesh.userData.renderChannels = ["low-energy", "low-roughness"];
      const shadow = createDeformationShadowMaterials(material);
      mesh.customDepthMaterial = shadow.depth;
      mesh.customDistanceMaterial = shadow.distance;
      return { compute, height, mesh, resolution, disposed: false };
    } catch (error) {
      mesh?.customDepthMaterial?.dispose();
      mesh?.customDistanceMaterial?.dispose();
      geometry?.dispose();
      material?.dispose();
      compute?.dispose();
      if (!computeOwnsSeed) seed.dispose();
      throw error;
    }
  }

  private attachUniforms(height: MembraneComputeVariable): void {
    setUniform(height, "uDelta", 0);
    setUniform(height, "uTime", 0);
    setUniform(height, "uWaveSpeed", 15);
    setUniform(height, "uDamping", 2.4);
    setUniform(height, "uPulseEnergy", 0);
    setUniform(height, "uPulseRadius", 0);
    setUniform(height, "uMembraneY", 0);
    setUniform(height, "uPointerUv", new THREE.Vector2(0.5, 0.5));
    setUniform(height, "uParticleTexture", null);
    setUniform(height, "uParticleSamples", PARTICLE_SAMPLES.map(([x, y]) => new THREE.Vector2(x, y)));
  }

  private advanceRuntime(
    runtime: Runtime,
    frame: FrameContext,
    particleTexture: THREE.Texture,
    pulseEnergy: number,
    membraneY: number,
  ): void {
    const pointer = frame.interaction.pointerWorld;
    const pointerUv = runtime.height.material.uniforms.uPointerUv!.value as THREE.Vector2;
    pointerUv.set(THREE.MathUtils.clamp(pointer[0] / MEMBRANE_SIZE + 0.5, 0, 1), THREE.MathUtils.clamp(pointer[2] / MEMBRANE_SIZE + 0.5, 0, 1));
    setUniform(runtime.height, "uDelta", Math.max(0, frame.deltaSeconds));
    setUniform(runtime.height, "uTime", frame.elapsedSeconds);
    setUniform(runtime.height, "uPulseEnergy", pulseEnergy);
    setUniform(runtime.height, "uPulseRadius", (frame.elapsedSeconds * 0.32) % 0.72);
    setUniform(runtime.height, "uMembraneY", membraneY);
    setUniform(runtime.height, "uParticleTexture", particleTexture);
    runtime.compute.compute();
    getMembraneShaderUniforms(runtime.mesh.material).uHeightTexture.value = runtime.compute.getCurrentRenderTarget(runtime.height).texture;
  }

  private setTransitionOpacity(runtime: Runtime, opacity: number): void {
    const material = runtime.mesh.material;
    material.opacity = THREE.MathUtils.clamp(opacity, 0, 1);
    if (!material.transparent || material.depthWrite) {
      material.transparent = true;
      material.depthWrite = false;
      material.needsUpdate = true;
    }
  }

  private restoreOpaque(runtime: Runtime): void {
    const material = runtime.mesh.material;
    material.opacity = 1;
    if (material.transparent || !material.depthWrite) {
      material.transparent = false;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  }

  private disposeRuntime(runtime: Runtime): void {
    if (runtime.disposed) return;
    runtime.disposed = true;
    runtime.compute.dispose();
    runtime.mesh.geometry.dispose();
    runtime.mesh.customDepthMaterial?.dispose();
    runtime.mesh.customDistanceMaterial?.dispose();
    runtime.mesh.material.dispose();
  }
}
