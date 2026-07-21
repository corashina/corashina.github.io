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
    } as unknown as THREE.WebGLRenderer;
    const material = new THREE.MeshPhysicalMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    const source = { object: mesh, getShadowMaterials: () => [material] };
    const pipeline = new RenderPipeline({
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      nebulaPass: new NebulaPass(QUALITY_PROFILES.medium),
      membrane: source,
      protoStar: source,
      profile: QUALITY_PROFILES.high,
    });
    const auxiliaryDispose = vi.spyOn(pipeline.auxiliaryPass, "dispose");

    expect(pipeline.composer.passes).toEqual([
      pipeline.renderPass, pipeline.gtaoPass, pipeline.ssrPass, pipeline.nebulaPass, pipeline.bloomPass, pipeline.outputPass,
    ]);
    expect(pipeline.ssrPass.selects).toEqual([mesh]);
    pipeline.resize(100, 60, 2);
    await Promise.resolve();
    expect(pipeline.auxiliaryPass.target.width).toBe(200);
    expect(pipeline.auxiliaryPass.target.height).toBe(120);

    pipeline.dispose();
    pipeline.dispose();
    expect(auxiliaryDispose).toHaveBeenCalledTimes(1);
    mesh.geometry.dispose();
    material.dispose();
  });
});
