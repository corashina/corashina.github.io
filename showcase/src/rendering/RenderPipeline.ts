import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSRPass } from "three/addons/postprocessing/SSRPass.js";
import type { FrameContext } from "../app/contracts";
import type { QualityProfile, ShadowLevel } from "../quality/qualityProfiles";
import { NebulaPass } from "../volume/NebulaPass";
import { AuxiliaryBufferPass } from "./AuxiliaryBufferPass";
import { MaskedBloomPass } from "./MaskedBloomPass";
import { applyPcss } from "./pcss";

export type ShadowMaterialSource = { getShadowMaterials(): THREE.Material[] };

export type RenderPipelineOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
  nebulaPass: NebulaPass;
  membrane: ShadowMaterialSource & { object: THREE.Object3D };
  protoStar: ShadowMaterialSource;
  profile: QualityProfile;
};

export type PipelineQuality = Pick<QualityProfile, "ssrScale" | "gtao" | "shadows">;

export function pipelineQuality(profile: QualityProfile): PipelineQuality {
  return { ssrScale: profile.ssrScale, gtao: profile.gtao, shadows: profile.shadows };
}

function configureGtao(pass: GTAOPass, level: QualityProfile["gtao"]): void {
  const samples = level === "high" ? 16 : level === "medium" ? 12 : level === "low" ? 8 : 4;
  pass.updateGtaoMaterial({ samples, radius: level === "high" ? 3 : 2, distanceExponent: 1.2 });
  pass.updatePdMaterial({ samples: level === "high" ? 16 : level === "medium" ? 12 : 8, rings: level === "high" ? 3 : 2 });
}

/** Owns the HDR postprocessing graph and its quality-dependent resources. */
export class RenderPipeline {
  readonly auxiliaryPass: AuxiliaryBufferPass;
  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly gtaoPass: GTAOPass;
  readonly ssrPass: SSRPass;
  readonly nebulaPass: NebulaPass;
  readonly bloomPass: MaskedBloomPass;
  readonly outputPass: OutputPass;
  private disposed = false;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private resizeScheduled = false;

  constructor(private readonly options: RenderPipelineOptions) {
    const { renderer, scene, camera, nebulaPass, membrane, profile } = options;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    let auxiliary: AuxiliaryBufferPass | undefined;
    let composer: EffectComposer | undefined;
    let gtao: GTAOPass | undefined;
    let ssr: SSRPass | undefined;
    let bloom: MaskedBloomPass | undefined;
    let output: OutputPass | undefined;
    try {
      auxiliary = new AuxiliaryBufferPass(scene, camera);
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true });
      composer = new EffectComposer(renderer, target);
      this.renderPass = new RenderPass(scene, camera);
      gtao = new GTAOPass(scene, camera, 1, 1);
      ssr = new SSRPass({ renderer, scene, camera, width: 1, height: 1, selects: [membrane.object as THREE.Mesh], groundReflector: null });
      bloom = new MaskedBloomPass(1, 1);
      output = new OutputPass();
      this.auxiliaryPass = auxiliary;
      this.composer = composer;
      this.gtaoPass = gtao;
      this.ssrPass = ssr;
      this.nebulaPass = nebulaPass;
      this.bloomPass = bloom;
      this.outputPass = output;
      composer.addPass(this.renderPass);
      composer.addPass(gtao);
      composer.addPass(ssr);
      composer.addPass(nebulaPass);
      composer.addPass(bloom);
      composer.addPass(output);
      this.setQuality(profile);
    } catch (error) {
      output?.dispose();
      bloom?.dispose();
      ssr?.dispose();
      gtao?.dispose();
      composer?.dispose();
      auxiliary?.dispose();
      throw error;
    }
  }

  render(frame: Pick<FrameContext, "deltaSeconds">): void {
    if (this.disposed) return;
    const { renderer, camera } = this.options;
    const previousTarget = renderer.getRenderTarget();
    const previousAutoClear = renderer.autoClear;
    try {
      this.auxiliaryPass.render(renderer);
      this.nebulaPass.setDepthTexture(this.auxiliaryPass.target.depthTexture ?? null);
      this.nebulaPass.setNormalTexture(this.auxiliaryPass.normalTexture);
      this.nebulaPass.setCamera(camera);
      this.bloomPass.setEnergyTexture(this.auxiliaryPass.energyTexture);
      this.ssrPass.ssrMaterial.uniforms.tDepth!.value = this.auxiliaryPass.target.depthTexture;
      this.ssrPass.ssrMaterial.uniforms.tNormal!.value = this.auxiliaryPass.normalTexture;
      this.ssrPass.ssrMaterial.uniforms.tMetalness!.value = this.auxiliaryPass.energyTexture;
      this.composer.render(Math.max(0, frame.deltaSeconds));
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
    }
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.dpr = Math.max(0.1, dpr);
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    queueMicrotask(() => {
      this.resizeScheduled = false;
      if (this.disposed) return;
      const scaledWidth = Math.max(1, Math.floor(this.width * this.dpr));
      const scaledHeight = Math.max(1, Math.floor(this.height * this.dpr));
      this.auxiliaryPass.setSize(scaledWidth, scaledHeight);
      this.composer.setPixelRatio(1);
      this.composer.setSize(scaledWidth, scaledHeight);
    });
  }

  setQuality(profile: QualityProfile): void {
    if (this.disposed) return;
    const config = pipelineQuality(profile);
    this.ssrPass.enabled = config.ssrScale > 0;
    this.ssrPass.resolutionScale = config.ssrScale || 1;
    configureGtao(this.gtaoPass, config.gtao);
    this.nebulaPass.setQuality(profile);
    this.applyShadowQuality(config.shadows);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.outputPass.dispose();
    this.bloomPass.dispose();
    this.nebulaPass.dispose();
    this.ssrPass.dispose();
    this.gtaoPass.dispose();
    this.composer.dispose();
    this.auxiliaryPass.dispose();
  }

  private applyShadowQuality(level: ShadowLevel): void {
    for (const material of [...this.options.protoStar.getShadowMaterials(), ...this.options.membrane.getShadowMaterials()]) {
      applyPcss(material, level);
    }
  }
}
