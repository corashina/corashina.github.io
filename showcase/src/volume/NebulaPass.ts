import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import type { InteractionSnapshot } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { copyFragmentShader, nebulaFragmentShader, nebulaVertexShader, temporalFragmentShader } from "./nebulaShader";
import { createNoiseVolume } from "./noiseVolume";

const VOLUME_CENTER = new THREE.Vector3(0, 0, 0);
const VOLUME_HALF_EXTENT = new THREE.Vector3(9, 6, 9);
const IDENTITY = new THREE.Matrix4();

function scaleFor(profile: QualityProfile): number {
  switch (profile.volumeSteps) {
    case 96:
    case 72:
    case 48:
      return 0.5;
    case 28:
      return 0.35;
  }
}

function createTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
  });
}

function createFallbackTexture(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

function createShaderMaterial(fragmentShader: string, uniforms: THREE.ShaderMaterialParameters["uniforms"]): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    depthWrite: false,
    depthTest: false,
    uniforms,
    vertexShader: nebulaVertexShader,
    fragmentShader,
  });
}

export type NebulaPassOptions = {
  noiseSize?: number;
  noiseSeed?: number;
};

/** A WebGL2 depth-aware raymarch pass with temporal reprojection history. */
export class NebulaPass extends Pass {
  readonly densityTexture: THREE.Data3DTexture;
  readonly material: THREE.ShaderMaterial;
  readonly quad: FullScreenQuad;
  renderTarget: THREE.WebGLRenderTarget;

  private readonly temporalMaterial: THREE.ShaderMaterial;
  private readonly copyMaterial: THREE.ShaderMaterial;
  private readonly fallbackTexture = createFallbackTexture();
  private readonly previousViewProjection = new THREE.Matrix4();
  private readonly currentViewProjection = new THREE.Matrix4();
  private readonly cameraPosition = new THREE.Vector3();
  private historyTargets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private historyIndex = 0;
  private width = 1;
  private height = 1;
  private scale: number;
  private historyValid = false;
  private frame = 0;
  private disposed = false;

  constructor(profile: QualityProfile, options: NebulaPassOptions = {}) {
    super();
    this.needsSwap = true;
    this.clear = false;
    this.scale = scaleFor(profile);
    this.densityTexture = createNoiseVolume(options.noiseSize ?? 32, options.noiseSeed ?? 0xc051c);
    this.material = createShaderMaterial(nebulaFragmentShader, {
      tDiffuse: { value: this.fallbackTexture },
      uSceneDepth: { value: this.fallbackTexture },
      uSceneNormal: { value: this.fallbackTexture },
      uDensityVolume: { value: this.densityTexture },
      uProjectionInverse: { value: new THREE.Matrix4() },
      uCameraWorldMatrix: { value: new THREE.Matrix4() },
      uCameraPosition: { value: new THREE.Vector3() },
      uVolumeCenter: { value: VOLUME_CENTER.clone() },
      uVolumeHalfExtent: { value: VOLUME_HALF_EXTENT.clone() },
      uPulsePosition: { value: new THREE.Vector3() },
      uPulseRadius: { value: 0 },
      uTime: { value: 0 },
      uFrame: { value: 0 },
      uMaxSteps: { value: profile.volumeSteps },
      uHasDepth: { value: 0 },
      uHasNormal: { value: 0 },
    });
    this.temporalMaterial = createShaderMaterial(temporalFragmentShader, {
      tCurrent: { value: this.fallbackTexture },
      tHistory: { value: this.fallbackTexture },
      uSceneDepth: { value: this.fallbackTexture },
      uProjectionInverse: { value: new THREE.Matrix4() },
      uCameraWorldMatrix: { value: new THREE.Matrix4() },
      uPreviousViewProjection: { value: new THREE.Matrix4() },
      uHistoryValid: { value: 0 },
      uHistoryWeight: { value: 0.88 },
    });
    this.copyMaterial = createShaderMaterial(copyFragmentShader, { tDiffuse: { value: this.fallbackTexture } });
    this.quad = new FullScreenQuad(this.material);
    this.renderTarget = createTarget(1, 1);
    this.historyTargets = [createTarget(1, 1), createTarget(1, 1)];
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed || profile.volumeSteps === this.material.uniforms.uMaxSteps!.value) return;
    this.scale = scaleFor(profile);
    this.material.uniforms.uMaxSteps!.value = profile.volumeSteps;
    this.recreateTargets();
  }

  setDepthTexture(texture: THREE.Texture | null): void {
    if (this.disposed) return;
    this.material.uniforms.uSceneDepth!.value = texture ?? this.fallbackTexture;
    this.temporalMaterial.uniforms.uSceneDepth!.value = texture ?? this.fallbackTexture;
    this.material.uniforms.uHasDepth!.value = texture === null ? 0 : 1;
    this.invalidateHistory();
  }

  setNormalTexture(texture: THREE.Texture | null): void {
    if (this.disposed) return;
    this.material.uniforms.uSceneNormal!.value = texture ?? this.fallbackTexture;
    this.material.uniforms.uHasNormal!.value = texture === null ? 0 : 1;
    this.invalidateHistory();
  }

  setCamera(camera: THREE.Camera, cameraCut = false): void {
    if (this.disposed) return;
    const projectionInverse = camera.projectionMatrixInverse;
    this.material.uniforms.uProjectionInverse!.value.copy(projectionInverse);
    this.material.uniforms.uCameraWorldMatrix!.value.copy(camera.matrixWorld);
    camera.getWorldPosition(this.cameraPosition);
    this.material.uniforms.uCameraPosition!.value.copy(this.cameraPosition);
    this.temporalMaterial.uniforms.uProjectionInverse!.value.copy(projectionInverse);
    this.temporalMaterial.uniforms.uCameraWorldMatrix!.value.copy(camera.matrixWorld);
    this.currentViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (cameraCut) this.invalidateHistory();
  }

  setInteraction(snapshot: InteractionSnapshot): void {
    if (this.disposed) return;
    const pulsePosition = this.material.uniforms.uPulsePosition!.value as THREE.Vector3;
    pulsePosition.set(snapshot.pointerWorld[0], snapshot.pointerWorld[1], snapshot.pointerWorld[2]);
    this.material.uniforms.uPulseRadius!.value = snapshot.pulseEnergy > 0 ? 1.25 + snapshot.pulseEnergy * 3.5 : 0;
    this.temporalMaterial.uniforms.uHistoryWeight!.value = snapshot.reducedMotion ? 0.55 : 0.88;
  }

  setElapsedTime(elapsedSeconds: number): void {
    if (!this.disposed) this.material.uniforms.uTime!.value = Math.max(0, elapsedSeconds);
  }

  invalidateHistory(): void {
    this.historyValid = false;
  }

  override setSize(width: number, height: number): void {
    if (this.disposed) return;
    const changed = this.width !== width || this.height !== height;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    if (changed || this.renderTarget.width !== this.scaledWidth() || this.renderTarget.height !== this.scaledHeight()) this.recreateTargets();
  }

  override render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
    _deltaTime: number,
    _maskActive: boolean,
  ): void {
    if (this.disposed) return;
    if (renderer.capabilities.isWebGL2 === false) throw new Error("NebulaPass requires WebGL2 for 3D volume sampling");

    this.material.uniforms.tDiffuse!.value = readBuffer.texture;
    this.material.uniforms.uFrame!.value = this.frame;
    renderer.setRenderTarget(this.renderTarget);
    this.quad.material = this.material;
    this.quad.render(renderer);

    const nextHistory = 1 - this.historyIndex as 0 | 1;
    this.temporalMaterial.uniforms.tCurrent!.value = this.renderTarget.texture;
    this.temporalMaterial.uniforms.tHistory!.value = this.historyTargets[this.historyIndex]!.texture;
    this.temporalMaterial.uniforms.uPreviousViewProjection!.value.copy(this.previousViewProjection);
    this.temporalMaterial.uniforms.uHistoryValid!.value = this.historyValid ? 1 : 0;
    renderer.setRenderTarget(this.historyTargets[nextHistory]);
    this.quad.material = this.temporalMaterial;
    this.quad.render(renderer);

    this.copyMaterial.uniforms.tDiffuse!.value = this.historyTargets[nextHistory].texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.material = this.copyMaterial;
    this.quad.render(renderer);
    this.quad.material = this.material;

    this.historyIndex = nextHistory;
    this.historyValid = true;
    this.previousViewProjection.copy(this.currentViewProjection);
    this.frame += 1;
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.densityTexture.dispose();
    this.fallbackTexture.dispose();
    this.material.dispose();
    this.temporalMaterial.dispose();
    this.copyMaterial.dispose();
    this.quad.dispose();
    this.releaseTargets();
  }

  private scaledWidth(): number {
    return Math.max(1, Math.floor(this.width * this.scale));
  }

  private scaledHeight(): number {
    return Math.max(1, Math.floor(this.height * this.scale));
  }

  private recreateTargets(): void {
    const targetWidth = this.scaledWidth();
    const targetHeight = this.scaledHeight();
    this.releaseTargets();
    this.renderTarget = createTarget(targetWidth, targetHeight);
    this.historyTargets = [createTarget(targetWidth, targetHeight), createTarget(targetWidth, targetHeight)];
    this.historyIndex = 0;
    this.historyValid = false;
  }

  private releaseTargets(): void {
    this.renderTarget.dispose();
    this.historyTargets[0].dispose();
    this.historyTargets[1].dispose();
  }
}
