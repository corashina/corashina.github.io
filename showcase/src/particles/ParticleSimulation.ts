import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { createParticleSeedTexture, type ParticleSeedTextures } from "./particleSeeds";
import { particleFragmentShader, particlePositionShader, particleVelocityShader, particleVertexShader } from "./particleShaders";

type Uniform = { value: unknown };

export type ComputeVariable = {
  name: string;
  material: { uniforms: Record<string, Uniform> };
  initialValueTexture: THREE.Texture;
};

export type ComputeRenderer = {
  addVariable(name: string, shader: string, texture: THREE.Texture): ComputeVariable;
  setVariableDependencies(variable: ComputeVariable, dependencies: ComputeVariable[]): void;
  init(): string | null;
  compute(): void;
  getCurrentRenderTarget(variable: ComputeVariable): { texture: THREE.Texture };
  dispose(): void;
};

export type ComputeFactory = (size: number, renderer: THREE.WebGLRenderer) => ComputeRenderer;

export type ParticleSimulationOptions = {
  computeFactory?: ComputeFactory;
  seed?: number;
};

type Runtime = {
  compute: ComputeRenderer;
  energy: THREE.DataTexture;
  points: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  position: ComputeVariable;
  size: number;
  velocity: ComputeVariable;
  disposed: boolean;
};

type Transition = {
  outgoing: Runtime;
  incoming: Runtime;
  elapsed: number;
};

const TRANSITION_DURATION = 0.45;

function createGpuCompute(size: number, renderer: THREE.WebGLRenderer): ComputeRenderer {
  return new GPUComputationRenderer(size, size, renderer) as unknown as ComputeRenderer;
}

function setUniform(variable: ComputeVariable, name: string, value: unknown): void {
  variable.material.uniforms[name] = { value };
}

function makeLookupGeometry(size: number): THREE.BufferGeometry {
  const count = size * size;
  const lookup = new Float32Array(count * 2);
  for (let index = 0; index < count; index += 1) {
    lookup[index * 2] = (index % size + 0.5) / size;
    lookup[index * 2 + 1] = (Math.floor(index / size) + 0.5) / size;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("lookup", new THREE.BufferAttribute(lookup, 2));
  geometry.setDrawRange(0, count);
  return geometry;
}

function makePoints(size: number, energy: THREE.DataTexture): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      texturePosition: { value: null },
      uEnergyTexture: { value: energy },
      uPointSize: { value: 16 },
      uOpacity: { value: 1 },
    },
    vertexShader: particleVertexShader,
    fragmentShader: particleFragmentShader,
  });
  const points = new THREE.Points(makeLookupGeometry(size), material);
  points.frustumCulled = false;
  return points;
}

export class ParticleSimulation {
  readonly object = new THREE.Group();
  private readonly computeFactory: ComputeFactory;
  private readonly seed: number;
  private current: Runtime;
  private transition: Transition | null = null;
  private disposed = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    profile: QualityProfile,
    options: ParticleSimulationOptions = {},
  ) {
    this.computeFactory = options.computeFactory ?? createGpuCompute;
    this.seed = options.seed ?? 0x51a7;
    this.current = this.createRuntime(profile);
    this.object.add(this.current.points);
  }

  update(frame: FrameContext): void {
    if (this.disposed) return;

    this.advanceRuntime(this.current, frame);
    if (this.transition === null) return;

    this.advanceRuntime(this.transition.incoming, frame);
    this.transition.elapsed += frame.deltaSeconds;
    const progress = Math.min(1, this.transition.elapsed / TRANSITION_DURATION);
    this.setOpacity(this.transition.outgoing, 1 - progress);
    this.setOpacity(this.transition.incoming, progress);

    if (this.transition.elapsed >= TRANSITION_DURATION - 1e-9) {
      const completed = this.transition;
      this.object.remove(completed.outgoing.points);
      this.disposeRuntime(completed.outgoing);
      this.setOpacity(completed.incoming, 1);
      this.current = completed.incoming;
      this.transition = null;
    }
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed) return;

    if (this.transition !== null) {
      if (profile.particles === this.transition.incoming.size) return;

      if (profile.particles === this.transition.outgoing.size) {
        this.object.remove(this.transition.incoming.points);
        this.disposeRuntime(this.transition.incoming);
        this.setOpacity(this.transition.outgoing, 1);
        this.current = this.transition.outgoing;
        this.transition = null;
        return;
      }

      this.object.remove(this.transition.incoming.points);
      this.disposeRuntime(this.transition.incoming);
      this.current = this.transition.outgoing;
      this.setOpacity(this.current, 1);
      this.transition = null;
    }

    if (profile.particles === this.current.size) return;

    const incoming = this.createRuntime(profile);
    this.setOpacity(incoming, 0);
    this.object.add(incoming.points);
    this.transition = { outgoing: this.current, incoming, elapsed: 0 };
  }

  getPositionTexture(): THREE.Texture {
    return this.current.compute.getCurrentRenderTarget(this.current.position).texture;
  }

  getEnergyTexture(): THREE.Texture {
    return this.current.energy;
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
    const size = profile.particles;
    const seeds = createParticleSeedTexture(size, this.seed);
    const compute = this.computeFactory(size, this.renderer);
    const texturePosition = compute.addVariable("texturePosition", particlePositionShader, seeds.position);
    const textureVelocity = compute.addVariable("textureVelocity", particleVelocityShader, seeds.velocity);
    compute.setVariableDependencies(texturePosition, [texturePosition, textureVelocity]);
    compute.setVariableDependencies(textureVelocity, [texturePosition, textureVelocity]);
    this.attachUniforms(texturePosition, textureVelocity);
    const error = compute.init();
    if (error !== null) {
      compute.dispose();
      seeds.energy.dispose();
      throw new Error(`Particle GPU computation could not initialize: ${error}`);
    }

    const points = makePoints(size, seeds.energy);
    return { compute, energy: seeds.energy, points, position: texturePosition, size, velocity: textureVelocity, disposed: false };
  }

  private attachUniforms(texturePosition: ComputeVariable, textureVelocity: ComputeVariable): void {
    setUniform(texturePosition, "uDelta", 0);
    setUniform(texturePosition, "uCorePosition", new THREE.Vector3());
    setUniform(textureVelocity, "uDelta", 0);
    setUniform(textureVelocity, "uCorePosition", new THREE.Vector3());
    setUniform(textureVelocity, "uPointerPosition", new THREE.Vector3());
    setUniform(textureVelocity, "uPointerGravity", 0);
    setUniform(textureVelocity, "uPulseEnergy", 0);
    setUniform(textureVelocity, "uPulseRadius", 3);
    setUniform(textureVelocity, "uOrbitStrength", 0.75);
    setUniform(textureVelocity, "uTurbulence", 0.35);
    setUniform(textureVelocity, "uDrag", 0);
  }

  private advanceRuntime(runtime: Runtime, frame: FrameContext): void {
    const pointer = frame.interaction.pointerWorld;
    const pointerPosition = runtime.velocity.material.uniforms.uPointerPosition!.value as THREE.Vector3;
    pointerPosition.set(pointer[0], pointer[1], pointer[2]);
    setUniform(runtime.position, "uDelta", frame.deltaSeconds);
    setUniform(runtime.velocity, "uDelta", frame.deltaSeconds);
    setUniform(runtime.velocity, "uPointerGravity", frame.interaction.gravity);
    setUniform(runtime.velocity, "uPulseEnergy", frame.interaction.pulseEnergy);
    setUniform(runtime.velocity, "uPulseRadius", 2 + (frame.elapsedSeconds % 2) * 3);
    setUniform(runtime.velocity, "uOrbitStrength", frame.interaction.reducedMotion ? 0.35 : 0.75);
    setUniform(runtime.velocity, "uTurbulence", frame.interaction.reducedMotion ? 0.16 : 0.35);
    setUniform(runtime.velocity, "uDrag", frame.interaction.reducedMotion ? 0.12 : 0.03);
    runtime.compute.compute();
    runtime.points.material.uniforms.texturePosition!.value = runtime.compute.getCurrentRenderTarget(runtime.position).texture;
  }

  private setOpacity(runtime: Runtime, opacity: number): void {
    runtime.points.material.uniforms.uOpacity!.value = opacity;
  }

  private disposeRuntime(runtime: Runtime): void {
    if (runtime.disposed) return;
    runtime.disposed = true;
    runtime.compute.dispose();
    runtime.energy.dispose();
    runtime.points.geometry.dispose();
    runtime.points.material.dispose();
  }
}
