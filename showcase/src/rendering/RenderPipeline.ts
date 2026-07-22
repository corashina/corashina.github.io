import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import type { FrameContext } from "../app/contracts";
import { MAX_PIXEL_RATIO } from "../particles/particleConfig";

export type RenderPipelineOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
};

type RendererSettings = {
  toneMapping: THREE.ToneMapping;
  outputColorSpace: string;
  shadowEnabled: boolean;
  shadowType: THREE.ShadowMapType;
};

/** Minimal particle scene → restrained luminance bloom → display output graph. */
export class RenderPipeline {
  readonly composer: EffectComposer;
  readonly renderPass: RenderPass;
  readonly bloomPass: UnrealBloomPass;
  readonly outputPass: OutputPass;
  private readonly initialSettings: RendererSettings;
  private disposed = false;

  constructor(private readonly options: RenderPipelineOptions) {
    const { renderer, scene, camera } = options;
    this.initialSettings = {
      toneMapping: renderer.toneMapping,
      outputColorSpace: renderer.outputColorSpace,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowType: renderer.shadowMap.type,
    };

    let composer: EffectComposer | undefined;
    let renderPass: RenderPass | undefined;
    let bloomPass: UnrealBloomPass | undefined;
    let outputPass: OutputPass | undefined;
    try {
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;
      const target = new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        depthBuffer: true,
      });
      composer = new EffectComposer(renderer, target);
      renderPass = new RenderPass(scene, camera);
      bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.4, 0.55);
      outputPass = new OutputPass();
      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(outputPass);
      this.composer = composer;
      this.renderPass = renderPass;
      this.bloomPass = bloomPass;
      this.outputPass = outputPass;
    } catch (error) {
      outputPass?.dispose();
      bloomPass?.dispose();
      composer?.dispose();
      this.restoreRenderer();
      throw error;
    }
  }

  render(frame: Pick<FrameContext, "deltaSeconds">): void {
    if (this.disposed) return;
    this.composer.render(Math.max(0, frame.deltaSeconds));
  }

  resize(width: number, height: number, dpr: number): void {
    if (this.disposed) return;
    this.composer.setPixelRatio(Math.min(Math.max(dpr, 0.1), MAX_PIXEL_RATIO));
    this.composer.setSize(Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.outputPass.dispose();
    this.bloomPass.dispose();
    this.bloomPass.materialHighPassFilter.dispose();
    this.composer.dispose();
    this.restoreRenderer();
  }

  private restoreRenderer(): void {
    const { renderer } = this.options;
    renderer.toneMapping = this.initialSettings.toneMapping;
    renderer.outputColorSpace = this.initialSettings.outputColorSpace;
    renderer.shadowMap.enabled = this.initialSettings.shadowEnabled;
    renderer.shadowMap.type = this.initialSettings.shadowType;
  }
}
