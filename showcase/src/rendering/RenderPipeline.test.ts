import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { RenderPipeline } from "./RenderPipeline";

function rendererHarness(): THREE.WebGLRenderer {
  return {
    toneMapping: THREE.NoToneMapping,
    outputColorSpace: THREE.LinearSRGBColorSpace,
    shadowMap: { enabled: true, type: THREE.PCFShadowMap },
    getPixelRatio: () => 1,
    getSize: (size: THREE.Vector2) => size.set(1, 1),
    autoClear: true,
    getRenderTarget: () => null,
    setRenderTarget: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
}

describe("RenderPipeline", () => {
  it("contains only scene render, restrained luminance bloom, and output conversion", () => {
    const renderer = rendererHarness();
    const pipeline = new RenderPipeline({ renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() });

    expect(pipeline.composer.passes).toEqual([pipeline.renderPass, pipeline.bloomPass, pipeline.outputPass]);
    expect(pipeline.bloomPass.strength).toBe(0.65);
    expect(pipeline.bloomPass.radius).toBe(0.4);
    expect(pipeline.bloomPass.threshold).toBe(0.55);
    expect(renderer.toneMapping).toBe(THREE.AgXToneMapping);
    expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace);
    expect(renderer.shadowMap.enabled).toBe(false);

    pipeline.dispose();
  });

  it("caps composer allocation at one device pixel per CSS pixel", () => {
    const pipeline = new RenderPipeline({ renderer: rendererHarness(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() });

    pipeline.resize(100, 60, 3);

    expect(pipeline.composer.readBuffer.width).toBe(100);
    expect(pipeline.composer.readBuffer.height).toBe(60);
    pipeline.dispose();
  });

  it("renders non-negative frame time and disposes once while restoring renderer settings", () => {
    const renderer = rendererHarness();
    const pipeline = new RenderPipeline({ renderer, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() });
    const render = vi.spyOn(pipeline.composer, "render").mockImplementation(() => undefined);
    const bloomDispose = vi.spyOn(pipeline.bloomPass, "dispose");
    const outputDispose = vi.spyOn(pipeline.outputPass, "dispose");

    pipeline.render({ deltaSeconds: -1 });
    pipeline.dispose();
    pipeline.dispose();

    expect(render).toHaveBeenCalledWith(0);
    expect(bloomDispose).toHaveBeenCalledTimes(1);
    expect(outputDispose).toHaveBeenCalledTimes(1);
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping);
    expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(renderer.shadowMap.enabled).toBe(true);
  });
});
