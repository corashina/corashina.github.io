import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { NebulaPass } from "../volume/NebulaPass";
import { pipelineQuality, RenderPipeline } from "./RenderPipeline";

describe("pipelineQuality", () => {
  it("maps approved SSR, GTAO, and shadow settings to every quality tier", () => {
    expect(pipelineQuality(QUALITY_PROFILES.low)).toEqual({ ssrScale: 0, gtao: "depth", shadows: "pcf" });
    expect(pipelineQuality(QUALITY_PROFILES.medium)).toEqual({ ssrScale: 0.25, gtao: "low", shadows: "pcf" });
    expect(pipelineQuality(QUALITY_PROFILES.high)).toEqual({ ssrScale: 0.5, gtao: "medium", shadows: "pcss-medium" });
    expect(pipelineQuality(QUALITY_PROFILES.ultra)).toEqual({ ssrScale: 0.5, gtao: "high", shadows: "pcss-high" });
  });

  it("orders scene, AO, selective SSR, nebula, masked bloom, and output; resize and disposal are idempotent", async () => {
    const renderer = {
      toneMapping: THREE.NoToneMapping,
      outputColorSpace: THREE.LinearSRGBColorSpace,
      shadowMap: { enabled: false, type: THREE.BasicShadowMap },
      getPixelRatio: () => 1,
      getSize: (size: THREE.Vector2) => size.set(1, 1),
      autoClear: true, getRenderTarget: () => null, setRenderTarget: () => undefined,
    } as unknown as THREE.WebGLRenderer;
    const material = new THREE.MeshPhysicalMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    const group = new THREE.Group();
    group.add(mesh);
    const source = { object: group, getShadowMaterials: () => [material] };
    const nebula = new NebulaPass(QUALITY_PROFILES.medium);
    const nebulaDispose = vi.spyOn(nebula, "dispose");
    const pipeline = new RenderPipeline({
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      nebulaPass: nebula,
      membrane: source,
      protoStar: source,
      profile: QUALITY_PROFILES.high,
    });
    const auxiliaryDispose = vi.spyOn(pipeline.auxiliaryPass, "dispose");

    expect(pipeline.composer.passes).toEqual([
      pipeline.renderPass, pipeline.gtaoPass, pipeline.reflectionPass, pipeline.nebulaPass, pipeline.bloomPass, pipeline.outputPass,
    ]);
    expect(pipeline.reflectionPass.selects).toEqual([mesh]);
    expect(pipeline.reflectionPass.material.uniforms.tNormalRoughness!.value).toBe(pipeline.auxiliaryPass.normalTexture);
    expect(pipeline.gtaoPass.depthTexture).toBe(pipeline.auxiliaryPass.target.depthTexture);
    expect(pipeline.gtaoPass.normalTexture).toBe(pipeline.auxiliaryPass.normalTexture);
    expect(pipeline.reflectionPass.ssrMaterial.uniforms.tMetalness!.value).toBe(pipeline.auxiliaryPass.energyTexture);
    expect(pipeline.reflectionPass.ssrMaterial.uniforms.tDepth!.value).toBe(pipeline.auxiliaryPass.target.depthTexture);
    expect(pipeline.reflectionPass.ssrMaterial.fragmentShader).toContain("texture2D(tMetalness,vUv).a");
    pipeline.resize(100, 60, 2);
    await Promise.resolve();
    expect(pipeline.auxiliaryPass.target.width).toBe(150);
    expect(pipeline.auxiliaryPass.target.height).toBe(90);
    expect(pipeline.reflectionPass.ssrRenderTarget.width).toBe(75);
    expect(pipeline.gtaoPass.gtaoRenderTarget.width).toBe(150);

    pipeline.dispose();
    pipeline.dispose();
    expect(auxiliaryDispose).toHaveBeenCalledTimes(1);
    expect(nebulaDispose).not.toHaveBeenCalled();
    nebula.dispose();
    mesh.geometry.dispose();
    material.dispose();
  });

  it("caps DPR by the active profile and disables SSR allocation for low quality", async () => {
    const renderer = {
      toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace,
      shadowMap: { enabled: false, type: THREE.BasicShadowMap }, getPixelRatio: () => 1,
      getSize: (size: THREE.Vector2) => size.set(1, 1),
      autoClear: true, getRenderTarget: () => null, setRenderTarget: () => undefined,
    } as unknown as THREE.WebGLRenderer;
    const material = new THREE.MeshPhysicalMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    const group = new THREE.Group();
    group.add(mesh);
    const source = { object: group, getShadowMaterials: () => [material] };
    const pipeline = new RenderPipeline({ renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), nebulaPass: new NebulaPass(QUALITY_PROFILES.low), membrane: source, protoStar: source, profile: QUALITY_PROFILES.low });

    pipeline.resize(100, 60, 2);
    await Promise.resolve();
    expect(pipeline.auxiliaryPass.target.width).toBe(100);
    expect(pipeline.reflectionPass.enabled).toBe(false);
    expect(pipeline.reflectionPass.ssrRenderTarget.width).toBe(1);
    expect(pipeline.gtaoPass.gtaoRenderTarget.width).toBe(25);
    expect(pipeline.gtaoPass.normalTexture).toBeUndefined();
    pipeline.setQuality(QUALITY_PROFILES.medium);
    expect(pipeline.auxiliaryPass.target.width).toBe(125);
    expect(pipeline.gtaoPass.gtaoRenderTarget.width).toBe(125);
    expect(pipeline.reflectionPass.ssrRenderTarget.width).toBe(31);
    pipeline.dispose();
    mesh.geometry.dispose();
    material.dispose();
  });

  it("selects every visible transition mesh and performs reflections without a scene render", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const first = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    const second = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    const hidden = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshPhysicalMaterial());
    hidden.visible = false;
    const group = new THREE.Group(); group.add(first, second, hidden);
    const source = { object: group, getShadowMaterials: () => [first.material, second.material] };
    const renderer = {
      toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace,
      shadowMap: { enabled: false, type: THREE.BasicShadowMap }, getPixelRatio: () => 1,
      getSize: (size: THREE.Vector2) => size.set(1, 1), autoClear: true,
      getRenderTarget: () => null, setRenderTarget: vi.fn(), clear: vi.fn(), render: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const pipeline = new RenderPipeline({ renderer, scene, camera, nebulaPass: new NebulaPass(QUALITY_PROFILES.high), membrane: source, protoStar: source, profile: QUALITY_PROFILES.high });
    pipeline.refreshSelections();
    expect(pipeline.reflectionPass.selects).toEqual([first, second]);

    const read = new THREE.WebGLRenderTarget(4, 4);
    const write = new THREE.WebGLRenderTarget(4, 4);
    pipeline.reflectionPass.render(renderer, write, read, 0, false);
    expect(vi.mocked(renderer.render).mock.calls.some(([object, activeCamera]) => object === scene && activeCamera === camera)).toBe(false);
    pipeline.dispose(); read.dispose(); write.dispose();
    for (const mesh of [first, second, hidden]) { mesh.geometry.dispose(); mesh.material.dispose(); }
  });

  it("rolls back PCSS, renderer settings, and caller-owned nebula quality when construction fails", () => {
    const renderer = {
      toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace,
      shadowMap: { enabled: false, type: THREE.BasicShadowMap }, getPixelRatio: () => 1,
      getSize: (size: THREE.Vector2) => size.set(1, 1), autoClear: true,
      getRenderTarget: () => null, setRenderTarget: vi.fn(),
    } as unknown as THREE.WebGLRenderer;
    const good = new THREE.MeshPhysicalMaterial();
    const originalHook = good.onBeforeCompile; const originalKey = good.customProgramCacheKey;
    const bad = new THREE.MeshPhysicalMaterial();
    const badHook = bad.onBeforeCompile;
    Object.defineProperty(bad, "onBeforeCompile", { configurable: true, get: () => badHook, set: () => { throw new Error("hook rejected"); } });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), good); const group = new THREE.Group(); group.add(mesh);
    const nebula = new NebulaPass(QUALITY_PROFILES.low);

    expect(() => new RenderPipeline({
      renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), nebulaPass: nebula,
      protoStar: { getShadowMaterials: () => [good] },
      membrane: { object: group, getShadowMaterials: () => [bad] }, profile: QUALITY_PROFILES.high,
    })).toThrow("hook rejected");

    expect(good.onBeforeCompile).toBe(originalHook); expect(good.customProgramCacheKey).toBe(originalKey);
    expect(nebula.material.uniforms.uMaxSteps!.value).toBe(QUALITY_PROFILES.low.volumeSteps);
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping);
    expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(renderer.shadowMap.enabled).toBe(false);
    Object.defineProperty(bad, "onBeforeCompile", { configurable: true, writable: true, value: badHook });
    nebula.dispose(); mesh.geometry.dispose(); good.dispose(); bad.dispose();
  });
});
