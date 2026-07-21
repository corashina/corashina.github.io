import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSRBlurShader, SSRShader } from "three/addons/shaders/SSRShader.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile } from "../quality/qualityProfiles";
import { NebulaPass } from "../volume/NebulaPass";
import { AuxiliaryBufferPass } from "./AuxiliaryBufferPass";
import { MaskedBloomPass } from "./MaskedBloomPass";
import { applyPcss, removePcss } from "./pcss";

export type ShadowMaterialSource = { getShadowMaterials(): THREE.Material[]; refreshShadowMaterials?: () => THREE.Material[] };
export type RenderPipelineOptions = {
  renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; nebulaPass: NebulaPass;
  membrane: ShadowMaterialSource & { object: THREE.Object3D }; protoStar: ShadowMaterialSource; profile: QualityProfile;
};
export type PipelineQuality = Pick<QualityProfile, "ssrScale" | "gtao" | "shadows">;
export function pipelineQuality(profile: QualityProfile): PipelineQuality {
  return { ssrScale: profile.ssrScale, gtao: profile.gtao, shadows: profile.shadows };
}

function visibleDescendantMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverseVisible((object) => { if (object instanceof THREE.Mesh) meshes.push(object); });
  return meshes;
}

function target(width = 1, height = 1): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  });
}

const compositeVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const compositeFragment = /* glsl */ `
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tReflection;
uniform sampler2D tNormalRoughness;
void main(){
  vec4 scene = texture2D(tScene, vUv);
  vec4 reflection = texture2D(tReflection, vUv);
  float roughness = texture2D(tNormalRoughness, vUv).a;
  gl_FragColor = vec4(scene.rgb + reflection.rgb * reflection.a * (1.0 - clamp(roughness, 0.0, 1.0)), scene.a);
}`;

/** SSRShader driven exclusively by composer color and the shared auxiliary G-buffer. */
export class AuxiliaryReflectionPass extends Pass {
  readonly ssrRenderTarget = target();
  readonly blurRenderTarget = target();
  readonly blurRenderTarget2 = target();
  readonly ssrMaterial: THREE.ShaderMaterial;
  readonly blurMaterial: THREE.ShaderMaterial;
  readonly blurMaterial2: THREE.ShaderMaterial;
  readonly material: THREE.ShaderMaterial;
  readonly quad: FullScreenQuad;
  selects: THREE.Mesh[] = [];
  private scale = 0;
  private disposed = false;

  constructor(
    private readonly camera: THREE.Camera,
    depth: THREE.Texture,
    normalRoughness: THREE.Texture,
    selectionEnergy: THREE.Texture,
  ) {
    super();
    this.needsSwap = true;
    const ssrFragment = SSRShader.fragmentShader.replace("texture2D(tMetalness,vUv).r", "texture2D(tMetalness,vUv).a");
    this.ssrMaterial = new THREE.ShaderMaterial({
      defines: { ...SSRShader.defines, SELECTIVE: true, PERSPECTIVE_CAMERA: camera instanceof THREE.PerspectiveCamera },
      uniforms: THREE.UniformsUtils.clone(SSRShader.uniforms),
      vertexShader: SSRShader.vertexShader, fragmentShader: ssrFragment,
      blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    });
    this.ssrMaterial.uniforms.tDepth!.value = depth;
    this.ssrMaterial.uniforms.tNormal!.value = normalRoughness;
    this.ssrMaterial.uniforms.tMetalness!.value = selectionEnergy;
    this.ssrMaterial.uniforms.opacity!.value = 0.55;
    this.ssrMaterial.uniforms.maxDistance!.value = 24;
    this.ssrMaterial.uniforms.thickness!.value = 0.08;
    this.blurMaterial = this.createBlurMaterial(this.ssrRenderTarget.texture);
    this.blurMaterial2 = this.createBlurMaterial(this.blurRenderTarget.texture);
    this.material = new THREE.ShaderMaterial({
      uniforms: { tScene: { value: null }, tReflection: { value: this.blurRenderTarget2.texture }, tNormalRoughness: { value: normalRoughness } },
      vertexShader: compositeVertex, fragmentShader: compositeFragment,
      blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.ssrMaterial);
    this.enabled = false;
  }

  setScale(scale: number): void {
    this.scale = THREE.MathUtils.clamp(scale, 0, 1);
    this.enabled = this.scale > 0;
  }

  setSelections(meshes: THREE.Mesh[]): void { this.selects = [...meshes]; }

  override setSize(width: number, height: number): void {
    if (this.disposed) return;
    const w = this.scale > 0 ? Math.max(1, Math.floor(width * this.scale)) : 1;
    const h = this.scale > 0 ? Math.max(1, Math.floor(height * this.scale)) : 1;
    for (const item of [this.ssrRenderTarget, this.blurRenderTarget, this.blurRenderTarget2]) item.setSize(w, h);
    this.ssrMaterial.defines.MAX_STEP = Math.ceil(Math.hypot(w, h));
    this.ssrMaterial.uniforms.resolution!.value.set(w, h);
    this.blurMaterial.uniforms.resolution!.value.set(w, h);
    this.blurMaterial2.uniforms.resolution!.value.set(w, h);
    this.ssrMaterial.needsUpdate = true;
  }

  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, _deltaTime: number, _maskActive: boolean): void {
    if (this.disposed || !this.enabled) return;
    const camera = this.camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
    this.ssrMaterial.uniforms.tDiffuse!.value = readBuffer.texture;
    this.ssrMaterial.uniforms.cameraNear!.value = camera.near;
    this.ssrMaterial.uniforms.cameraFar!.value = camera.far;
    this.ssrMaterial.uniforms.cameraProjectionMatrix!.value.copy(camera.projectionMatrix);
    this.ssrMaterial.uniforms.cameraInverseProjectionMatrix!.value.copy(camera.projectionMatrixInverse);
    try {
      renderer.setRenderTarget(this.ssrRenderTarget); renderer.clear();
      this.quad.material = this.ssrMaterial; this.quad.render(renderer);
      renderer.setRenderTarget(this.blurRenderTarget);
      this.quad.material = this.blurMaterial; this.quad.render(renderer);
      renderer.setRenderTarget(this.blurRenderTarget2);
      this.quad.material = this.blurMaterial2; this.quad.render(renderer);
      this.material.uniforms.tScene!.value = readBuffer.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.material = this.material; this.quad.render(renderer);
    } finally {
      this.quad.material = this.ssrMaterial;
    }
  }

  override dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ssrRenderTarget.dispose(); this.blurRenderTarget.dispose(); this.blurRenderTarget2.dispose();
    this.ssrMaterial.dispose(); this.blurMaterial.dispose(); this.blurMaterial2.dispose(); this.material.dispose(); this.quad.dispose();
  }

  private createBlurMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
    const material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SSRBlurShader.uniforms),
      vertexShader: SSRBlurShader.vertexShader, fragmentShader: SSRBlurShader.fragmentShader,
      blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    });
    material.uniforms.tDiffuse!.value = texture;
    return material;
  }
}

type RenderState = {
  target: THREE.WebGLRenderTarget | null; activeCubeFace?: number; activeMipmapLevel?: number;
  autoClear: boolean; toneMapping: THREE.ToneMapping; outputColorSpace: string;
  shadowEnabled: boolean; shadowType: THREE.ShadowMapType;
  background: THREE.Scene["background"]; fog: THREE.Scene["fog"]; overrideMaterial: THREE.Material | null;
  clearColor?: THREE.Color; clearAlpha?: number; viewport?: THREE.Vector4; scissor?: THREE.Vector4; scissorTest?: boolean;
};

function capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene): RenderState {
  const optional = renderer as THREE.WebGLRenderer & {
    getActiveCubeFace?: () => number; getActiveMipmapLevel?: () => number;
    getViewport?: (value: THREE.Vector4) => THREE.Vector4; getScissor?: (value: THREE.Vector4) => THREE.Vector4;
    getScissorTest?: () => boolean;
  };
  return {
    target: renderer.getRenderTarget(), activeCubeFace: optional.getActiveCubeFace?.(), activeMipmapLevel: optional.getActiveMipmapLevel?.(),
    autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, outputColorSpace: renderer.outputColorSpace,
    shadowEnabled: renderer.shadowMap.enabled, shadowType: renderer.shadowMap.type,
    background: scene.background, fog: scene.fog, overrideMaterial: scene.overrideMaterial,
    clearColor: typeof renderer.getClearColor === "function" ? renderer.getClearColor(new THREE.Color()) : undefined,
    clearAlpha: typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : undefined,
    viewport: optional.getViewport?.(new THREE.Vector4()), scissor: optional.getScissor?.(new THREE.Vector4()), scissorTest: optional.getScissorTest?.(),
  };
}

function restore(renderer: THREE.WebGLRenderer, scene: THREE.Scene, state: RenderState, includeSettings: boolean): void {
  if (state.activeCubeFace === undefined && state.activeMipmapLevel === undefined) renderer.setRenderTarget(state.target);
  else renderer.setRenderTarget(state.target, state.activeCubeFace, state.activeMipmapLevel);
  renderer.autoClear = state.autoClear;
  scene.background = state.background; scene.fog = state.fog; scene.overrideMaterial = state.overrideMaterial;
  if (state.clearColor !== undefined && typeof renderer.setClearColor === "function") renderer.setClearColor(state.clearColor, state.clearAlpha);
  if (state.viewport !== undefined) renderer.setViewport(state.viewport);
  if (state.scissor !== undefined) renderer.setScissor(state.scissor);
  if (state.scissorTest !== undefined) renderer.setScissorTest(state.scissorTest);
  if (includeSettings) {
    renderer.toneMapping = state.toneMapping; renderer.outputColorSpace = state.outputColorSpace;
    renderer.shadowMap.enabled = state.shadowEnabled; renderer.shadowMap.type = state.shadowType;
  }
}

function configureGtao(pass: GTAOPass, level: QualityProfile["gtao"]): void {
  const samples = level === "high" ? 16 : level === "medium" ? 12 : level === "low" ? 8 : 4;
  pass.updateGtaoMaterial({ samples, radius: level === "depth" ? 1.25 : 2, distanceExponent: 1.2 });
  pass.updatePdMaterial({ samples: level === "high" ? 16 : level === "medium" ? 12 : 8, rings: level === "high" ? 3 : 2 });
}

/** Owns the HDR scene → external-G-buffer AO → aux SSR → nebula → bloom graph. */
export class RenderPipeline {
  readonly auxiliaryPass: AuxiliaryBufferPass;
  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly gtaoPass: GTAOPass;
  readonly reflectionPass: AuxiliaryReflectionPass;
  readonly nebulaPass: NebulaPass;
  readonly bloomPass: MaskedBloomPass;
  readonly outputPass: OutputPass;
  private disposed = false;
  private width = 1; private height = 1; private dpr = 1; private resizeScheduled = false;
  private profile: QualityProfile;
  private readonly initialState: RenderState;
  private readonly shadowMaterials = new Set<THREE.Material>();

  constructor(private readonly options: RenderPipelineOptions) {
    const { renderer, scene, camera, nebulaPass, profile } = options;
    this.profile = profile; this.initialState = capture(renderer, scene); this.nebulaPass = nebulaPass;
    const previousNebulaSteps = nebulaPass.material.uniforms.uMaxSteps!.value as QualityProfile["volumeSteps"];
    let auxiliary: AuxiliaryBufferPass | undefined; let composer: EffectComposer | undefined;
    let composerTarget: THREE.WebGLRenderTarget | undefined; let gtao: GTAOPass | undefined;
    let reflection: AuxiliaryReflectionPass | undefined; let bloom: MaskedBloomPass | undefined; let output: OutputPass | undefined;
    try {
      renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      auxiliary = new AuxiliaryBufferPass(scene, camera);
      composerTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true });
      composer = new EffectComposer(renderer, composerTarget); composerTarget = undefined;
      this.renderPass = new RenderPass(scene, camera);
      gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.setGBuffer(auxiliary.target.depthTexture!, auxiliary.normalTexture as unknown as THREE.DepthTexture);
      reflection = new AuxiliaryReflectionPass(camera, auxiliary.target.depthTexture!, auxiliary.normalTexture, auxiliary.energyTexture);
      bloom = new MaskedBloomPass(1, 1); output = new OutputPass();
      this.auxiliaryPass = auxiliary; this.composer = composer; this.gtaoPass = gtao;
      this.reflectionPass = reflection; this.bloomPass = bloom; this.outputPass = output;
      composer.addPass(this.renderPass); composer.addPass(gtao); composer.addPass(reflection); composer.addPass(nebulaPass); composer.addPass(bloom); composer.addPass(output);
      this.refreshSelections();
      this.setQuality(profile);
    } catch (error) {
      for (const source of [options.protoStar, options.membrane]) {
        try { for (const material of source.getShadowMaterials()) removePcss(material); } catch { /* preserve the construction error */ }
      }
      try { nebulaPass.setQuality({ ...profile, volumeSteps: previousNebulaSteps }); } catch { /* caller still owns cleanup */ }
      output?.dispose(); bloom?.dispose(); reflection?.dispose();
      if (gtao !== undefined) this.disposeGtao(gtao);
      composer?.dispose(); composerTarget?.dispose(); auxiliary?.dispose();
      restore(renderer, scene, this.initialState, true);
      throw error;
    }
  }

  render(frame: Pick<FrameContext, "deltaSeconds">): void {
    if (this.disposed) return;
    const { renderer, scene, camera } = this.options;
    const state = capture(renderer, scene);
    try {
      this.refreshSelections(); this.refreshShadowMaterials();
      this.auxiliaryPass.render(renderer);
      this.nebulaPass.setDepthTexture(this.auxiliaryPass.target.depthTexture ?? null);
      this.nebulaPass.setNormalTexture(this.auxiliaryPass.normalTexture); this.nebulaPass.setCamera(camera);
      this.bloomPass.setEnergyTexture(this.auxiliaryPass.energyTexture);
      this.composer.render(Math.max(0, frame.deltaSeconds));
    } finally { restore(renderer, scene, state, false); }
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    this.width = Math.max(1, Math.floor(width)); this.height = Math.max(1, Math.floor(height)); this.dpr = Math.max(0.1, dpr);
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    queueMicrotask(() => { if (!this.resizeScheduled) return; this.resizeScheduled = false; if (!this.disposed) this.applySize(); });
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed) return;
    this.profile = profile; const config = pipelineQuality(profile);
    this.reflectionPass.setScale(config.ssrScale);
    this.gtaoPass.setGBuffer(this.auxiliaryPass.target.depthTexture!, config.gtao === "depth" ? undefined : this.auxiliaryPass.normalTexture as unknown as THREE.DepthTexture);
    configureGtao(this.gtaoPass, config.gtao);
    this.nebulaPass.setQuality(profile);
    this.options.renderer.shadowMap.type = config.shadows === "pcf" ? THREE.PCFShadowMap : THREE.BasicShadowMap;
    this.resizeScheduled = false; this.applySize(); this.refreshShadowMaterials();
  }

  refreshSelections(): void {
    const selects = visibleDescendantMeshes(this.options.membrane.object);
    this.reflectionPass.setSelections(selects); this.auxiliaryPass.setReflectiveObjects(selects);
  }

  refreshShadowMaterials(): void {
    const active = new Set<THREE.Material>();
    for (const source of [this.options.protoStar, this.options.membrane]) {
      for (const material of source.refreshShadowMaterials?.() ?? source.getShadowMaterials()) {
        active.add(material); applyPcss(material, this.profile.shadows);
      }
    }
    for (const material of this.shadowMaterials) {
      if (active.has(material)) continue;
      removePcss(material); this.shadowMaterials.delete(material);
    }
    for (const material of active) this.shadowMaterials.add(material);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.resizeScheduled = false;
    for (const material of this.shadowMaterials) removePcss(material); this.shadowMaterials.clear();
    this.outputPass.dispose(); this.bloomPass.dispose();
    // NebulaPass is supplied by the caller and remains caller-owned.
    this.reflectionPass.dispose(); this.disposeGtao(this.gtaoPass); this.composer.dispose(); this.auxiliaryPass.dispose();
    restore(this.options.renderer, this.options.scene, this.initialState, true);
  }

  private applySize(): void {
    const effectiveDpr = Math.min(this.dpr, this.profile.pixelRatio);
    const w = Math.max(1, Math.floor(this.width * effectiveDpr)); const h = Math.max(1, Math.floor(this.height * effectiveDpr));
    this.auxiliaryPass.setSize(w, h); this.composer.setPixelRatio(1); this.composer.setSize(w, h);
    const aoScale = this.profile.gtao === "depth" ? 0.25 : 1;
    this.gtaoPass.setSize(Math.max(1, Math.floor(w * aoScale)), Math.max(1, Math.floor(h * aoScale)));
  }

  private disposeGtao(pass: GTAOPass): void {
    pass.dispose();
    // r185 leaves these two owned shader materials undisposed.
    pass.gtaoMaterial.dispose(); pass.blendMaterial.dispose();
  }
}
