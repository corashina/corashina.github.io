import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";
import type { FrameContext } from "../app/contracts";
import { DEFAULT_SCENE_PARAMETERS, type SceneParameters } from "../runtime/SceneParameters";
import { PARTICLE_TEXTURE_SIZE } from "./particleConfig";
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
  velocity: ComputeVariable;
  disposed: boolean;
};

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
  private disposed = false;
  private parameters: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS };

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    options: ParticleSimulationOptions = {},
  ) {
    this.computeFactory = options.computeFactory ?? createGpuCompute;
    this.seed = options.seed ?? 0x51a7;
    this.current = this.createRuntime();
    this.object.add(this.current.points);
  }

  update(frame: FrameContext): void {
    if (this.disposed) return;

    this.advanceRuntime(this.current, frame);
  }

  setParameters(parameters: SceneParameters): void {
    if (this.disposed) return;
    this.parameters = { ...parameters };
    this.current.points.material.uniforms.uPointSize!.value = parameters.particleSize;
  }

  getPositionTexture(): THREE.Texture {
    return this.current.compute.getCurrentRenderTarget(this.current.position).texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeRuntime(this.current);
    this.object.clear();
  }

  private createRuntime(): Runtime {
    const size = PARTICLE_TEXTURE_SIZE;
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
    return { compute, energy: seeds.energy, points, position: texturePosition, velocity: textureVelocity, disposed: false };
  }

  private attachUniforms(texturePosition: ComputeVariable, textureVelocity: ComputeVariable): void {
    setUniform(texturePosition, "uDelta", 0);
    setUniform(texturePosition, "uCorePosition", new THREE.Vector3());
    setUniform(textureVelocity, "uDelta", 0);
    setUniform(textureVelocity, "uCorePosition", new THREE.Vector3());
    setUniform(textureVelocity, "uPointerPosition", new THREE.Vector3());
    setUniform(textureVelocity, "uPointerVelocity", new THREE.Vector2());
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
    const pointerVelocity = runtime.velocity.material.uniforms.uPointerVelocity!.value as THREE.Vector2;
    pointerPosition.set(pointer[0], pointer[1], pointer[2]);
    const pointerMotionScale = frame.interaction.reducedMotion ? 0.2 : 1;
    pointerVelocity.set(frame.interaction.pointerVelocity[0], frame.interaction.pointerVelocity[1]).clampLength(0, 1).multiplyScalar(pointerMotionScale);
    const simulationDelta = frame.deltaSeconds * this.parameters.speed;
    setUniform(runtime.position, "uDelta", simulationDelta);
    setUniform(runtime.velocity, "uDelta", simulationDelta);
    setUniform(runtime.velocity, "uPointerGravity", frame.interaction.gravity);
    setUniform(runtime.velocity, "uPulseEnergy", frame.interaction.pulseEnergy * this.parameters.pulseStrength * (frame.interaction.reducedMotion ? 0.12 : 1));
    setUniform(runtime.velocity, "uPulseRadius", frame.interaction.pulseRadius);
    setUniform(runtime.velocity, "uOrbitStrength", frame.interaction.reducedMotion ? Math.min(0.2, this.parameters.orbitStrength) : this.parameters.orbitStrength);
    setUniform(runtime.velocity, "uTurbulence", frame.interaction.reducedMotion ? 0 : this.parameters.turbulence);
    setUniform(runtime.velocity, "uDrag", frame.interaction.reducedMotion ? Math.max(0.3, this.parameters.drag) : this.parameters.drag);
    runtime.compute.compute();
    runtime.points.material.uniforms.texturePosition!.value = runtime.compute.getCurrentRenderTarget(runtime.position).texture;
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
