import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSRPass } from "three/addons/postprocessing/SSRPass.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile, ShadowLevel } from "../quality/qualityProfiles";
import { NebulaPass } from "../volume/NebulaPass";
import { AuxiliaryBufferPass } from "./AuxiliaryBufferPass";
import { MaskedBloomPass } from "./MaskedBloomPass";
import { applyPcss, removePcss } from "./pcss";

export type ShadowMaterialSource = { getShadowMaterials(): THREE.Material[]; refreshShadowMaterials?: () => THREE.Material[] };
export type RenderPipelineOptions = { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera; nebulaPass: NebulaPass; membrane: ShadowMaterialSource & { object: THREE.Object3D }; protoStar: ShadowMaterialSource; profile: QualityProfile };
export type PipelineQuality = Pick<QualityProfile, "ssrScale" | "gtao" | "shadows">;
export function pipelineQuality(profile: QualityProfile): PipelineQuality { return { ssrScale: profile.ssrScale, gtao: profile.gtao, shadows: profile.shadows }; }

const compositeVertex = /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const compositeFragment = /* glsl */ `varying vec2 vUv; uniform sampler2D tScene; uniform sampler2D tReflection; uniform sampler2D tRoughness; void main(){ vec4 scene=texture2D(tScene,vUv); float roughness=texture2D(tRoughness,vUv).a; vec3 reflection=texture2D(tReflection,vUv).rgb*(1.0-clamp(roughness,0.0,1.0)); gl_FragColor=vec4(scene.rgb+reflection,scene.a); }`;

/** Converts the stock SSR reflection-only output into an AO-preserving composer pass. */
export class ReflectionCompositePass extends Pass {
  readonly target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false });
  readonly material = new THREE.ShaderMaterial({ uniforms: { tScene: { value: null }, tReflection: { value: null }, tRoughness: { value: null } }, vertexShader: compositeVertex, fragmentShader: compositeFragment, depthTest: false, depthWrite: false });
  readonly quad = new FullScreenQuad(this.material);
  private scale = 0;
  private disposed = false;

  constructor(readonly ssrPass: SSRPass, roughness: THREE.Texture) { super(); this.needsSwap = true; this.material.uniforms.tRoughness!.value = roughness; }
  setScale(scale: number): void { this.scale = scale; this.ssrPass.enabled = scale > 0; }
  override setSize(width: number, height: number): void {
    if (this.disposed) return;
    if (this.scale <= 0) { this.target.setSize(1, 1); this.ssrPass.setSize(1, 1); return; }
    this.ssrPass.resolutionScale = this.scale;
    this.ssrPass.setSize(width, height);
    this.target.setSize(Math.max(1, Math.floor(width * this.scale)), Math.max(1, Math.floor(height * this.scale)));
  }
  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, _deltaTime: number, _maskActive: boolean): void {
    if (this.disposed || this.scale <= 0) { this.material.uniforms.tScene!.value = readBuffer.texture; renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.quad.render(renderer); return; }
    const output = this.ssrPass.output;
    const toScreen = this.ssrPass.renderToScreen;
    try {
      this.ssrPass.output = SSRPass.OUTPUT.SSR;
      this.ssrPass.renderToScreen = false;
      this.ssrPass.render(renderer, this.target, readBuffer, _deltaTime, _maskActive);
      this.material.uniforms.tScene!.value = readBuffer.texture;
      this.material.uniforms.tReflection!.value = this.target.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.quad.render(renderer);
    } finally { this.ssrPass.output = output; this.ssrPass.renderToScreen = toScreen; }
  }
  override dispose(): void { if (!this.disposed) { this.disposed = true; this.target.dispose(); this.material.dispose(); this.quad.dispose(); } }
}

type RenderState = { target: THREE.WebGLRenderTarget | null; autoClear: boolean; toneMapping: THREE.ToneMapping; outputColorSpace: string; shadowEnabled: boolean; shadowType: THREE.ShadowMapType; background: THREE.Scene["background"]; fog: THREE.Scene["fog"]; overrideMaterial: THREE.Material | null; clearColor?: THREE.Color; clearAlpha?: number };
function capture(renderer: THREE.WebGLRenderer, scene: THREE.Scene): RenderState { return { target: renderer.getRenderTarget(), autoClear: renderer.autoClear, toneMapping: renderer.toneMapping, outputColorSpace: renderer.outputColorSpace, shadowEnabled: renderer.shadowMap.enabled, shadowType: renderer.shadowMap.type, background: scene.background, fog: scene.fog, overrideMaterial: scene.overrideMaterial, clearColor: typeof renderer.getClearColor === "function" ? renderer.getClearColor(new THREE.Color()) : undefined, clearAlpha: typeof renderer.getClearAlpha === "function" ? renderer.getClearAlpha() : undefined }; }
function restore(renderer: THREE.WebGLRenderer, scene: THREE.Scene, state: RenderState, includeSettings: boolean): void { renderer.setRenderTarget(state.target); renderer.autoClear = state.autoClear; scene.background = state.background; scene.fog = state.fog; scene.overrideMaterial = state.overrideMaterial; if (state.clearColor !== undefined && typeof renderer.setClearColor === "function") renderer.setClearColor(state.clearColor, state.clearAlpha); if (includeSettings) { renderer.toneMapping = state.toneMapping; renderer.outputColorSpace = state.outputColorSpace; renderer.shadowMap.enabled = state.shadowEnabled; renderer.shadowMap.type = state.shadowType; } }

function configureGtao(pass: GTAOPass, level: QualityProfile["gtao"]): void { const samples = level === "high" ? 16 : level === "medium" ? 12 : level === "low" ? 8 : 4; pass.updateGtaoMaterial({ samples, radius: level === "depth" ? 1.25 : 2, distanceExponent: 1.2 }); pass.updatePdMaterial({ samples: level === "high" ? 16 : level === "medium" ? 12 : 8, rings: level === "high" ? 3 : 2 }); }

/** Owns the HDR scene→AO→reflection→nebula→bloom→output graph. */
export class RenderPipeline {
  readonly auxiliaryPass: AuxiliaryBufferPass; readonly composer: EffectComposer; readonly renderPass: RenderPass; readonly gtaoPass: GTAOPass; readonly ssrPass: SSRPass; readonly reflectionPass: ReflectionCompositePass; readonly nebulaPass: NebulaPass; readonly bloomPass: MaskedBloomPass; readonly outputPass: OutputPass;
  private disposed = false; private width = 1; private height = 1; private dpr = 1; private resizeScheduled = false; private profile: QualityProfile; private readonly initialState: RenderState; private readonly shadowMaterials = new Set<THREE.Material>();
  constructor(private readonly options: RenderPipelineOptions) {
    const { renderer, scene, camera, nebulaPass, membrane, profile } = options;
    this.profile = profile; this.initialState = capture(renderer, scene);
    let auxiliary: AuxiliaryBufferPass | undefined; let composer: EffectComposer | undefined; let gtao: GTAOPass | undefined; let ssr: SSRPass | undefined; let reflection: ReflectionCompositePass | undefined; let bloom: MaskedBloomPass | undefined; let output: OutputPass | undefined;
    try {
      renderer.toneMapping = THREE.AgXToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
      auxiliary = new AuxiliaryBufferPass(scene, camera);
      composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true }));
      this.renderPass = new RenderPass(scene, camera);
      gtao = new GTAOPass(scene, camera, 1, 1);
      gtao.setGBuffer(auxiliary.target.depthTexture!, auxiliary.normalTexture as unknown as THREE.DepthTexture);
      ssr = new SSRPass({ renderer, scene, camera, width: 1, height: 1, selects: [membrane.object as THREE.Mesh], groundReflector: null });
      reflection = new ReflectionCompositePass(ssr, auxiliary.normalTexture);
      bloom = new MaskedBloomPass(1, 1); output = new OutputPass();
      this.auxiliaryPass = auxiliary; this.composer = composer; this.gtaoPass = gtao; this.ssrPass = ssr; this.reflectionPass = reflection; this.nebulaPass = nebulaPass; this.bloomPass = bloom; this.outputPass = output;
      composer.addPass(this.renderPass); composer.addPass(gtao); composer.addPass(reflection); composer.addPass(nebulaPass); composer.addPass(bloom); composer.addPass(output);
      this.setQuality(profile);
    } catch (error) { output?.dispose(); bloom?.dispose(); reflection?.dispose(); ssr?.dispose(); gtao?.dispose(); composer?.dispose(); auxiliary?.dispose(); restore(renderer, scene, this.initialState, true); throw error; }
  }
  render(frame: Pick<FrameContext, "deltaSeconds">): void { if (this.disposed) return; const { renderer, scene, camera } = this.options; const state = capture(renderer, scene); try { this.auxiliaryPass.render(renderer); this.nebulaPass.setDepthTexture(this.auxiliaryPass.target.depthTexture ?? null); this.nebulaPass.setNormalTexture(this.auxiliaryPass.normalTexture); this.nebulaPass.setCamera(camera); this.bloomPass.setEnergyTexture(this.auxiliaryPass.energyTexture); this.composer.render(Math.max(0, frame.deltaSeconds)); } finally { restore(renderer, scene, state, false); } }
  resize(width: number, height: number, dpr: number): void { if (this.disposed) return; this.width = Math.max(1, Math.floor(width)); this.height = Math.max(1, Math.floor(height)); this.dpr = Math.max(0.1, dpr); if (this.resizeScheduled) return; this.resizeScheduled = true; queueMicrotask(() => { this.resizeScheduled = false; if (this.disposed) return; const effectiveDpr = Math.min(this.dpr, this.profile.pixelRatio); const w = Math.max(1, Math.floor(this.width * effectiveDpr)); const h = Math.max(1, Math.floor(this.height * effectiveDpr)); this.auxiliaryPass.setSize(w, h); this.composer.setPixelRatio(1); this.composer.setSize(w, h); const aoScale = this.profile.gtao === "depth" || this.profile.gtao === "low" ? 0.25 : 1; this.gtaoPass.setSize(Math.max(1, Math.floor(w * aoScale)), Math.max(1, Math.floor(h * aoScale))); }); }
  setQuality(profile: QualityProfile): void { if (this.disposed) return; this.profile = profile; const config = pipelineQuality(profile); this.reflectionPass.setScale(config.ssrScale); this.ssrPass.enabled = config.ssrScale > 0; configureGtao(this.gtaoPass, config.gtao); this.nebulaPass.setQuality(profile); this.options.renderer.shadowMap.type = config.shadows === "pcf" ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap; this.refreshShadowMaterials(); }
  refreshShadowMaterials(): void { const sources = [this.options.protoStar, this.options.membrane]; for (const source of sources) for (const material of source.refreshShadowMaterials?.() ?? source.getShadowMaterials()) { this.shadowMaterials.add(material); applyPcss(material, this.profile.shadows); } }
  dispose(): void { if (this.disposed) return; this.disposed = true; for (const material of this.shadowMaterials) removePcss(material); this.outputPass.dispose(); this.bloomPass.dispose(); this.nebulaPass.dispose(); this.reflectionPass.dispose(); this.ssrPass.dispose(); this.gtaoPass.dispose(); this.composer.dispose(); this.auxiliaryPass.dispose(); restore(this.options.renderer, this.options.scene, this.initialState, true); }
}
