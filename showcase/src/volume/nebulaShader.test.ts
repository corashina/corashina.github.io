import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { copyFragmentShader, nebulaFragmentShader, nebulaVertexShader, temporalFragmentShader } from "./nebulaShader";
import { NebulaPass } from "./NebulaPass";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";

describe("nebulaFragmentShader", () => {
  it("raymarches a depth-bounded, normal-softened volume with temporal inputs", () => {
    expect(nebulaFragmentShader).toContain("reconstructWorldPosition");
    expect(nebulaFragmentShader).toContain("uSceneDepth");
    expect(nebulaFragmentShader).toContain("rayBoxIntersection");
    expect(nebulaFragmentShader).toContain("uMaxSteps");
    expect(nebulaFragmentShader).toContain("blueNoise");
    expect(nebulaFragmentShader).toContain("uSceneNormal");
    expect(nebulaFragmentShader).toContain("density < 0.015");
    expect(nebulaFragmentShader).toContain("transmittance = min");
    expect(nebulaFragmentShader).toContain("uPulseRadius");
  });

  it("leaves the one GLSL3 version declaration to Three and uses matching shader stages", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.low);
    const sources = [nebulaVertexShader, nebulaFragmentShader, temporalFragmentShader, copyFragmentShader];

    expect(pass.material.glslVersion).toBe(THREE.GLSL3);
    expect(sources.every((source) => !source.includes("#version"))).toBe(true);
    expect(nebulaVertexShader).toContain("out vec2 vUv");
    expect(nebulaFragmentShader).toContain("in vec2 vUv");
    expect(nebulaFragmentShader).toContain("out vec4 fragColor");
    pass.dispose();
  });

  it("renders only volume data at reduced resolution and composites the scene at full resolution", () => {
    expect(nebulaFragmentShader).not.toContain("tDiffuse");
    expect(nebulaFragmentShader).toContain("vec4(scatteredLight, transmittance)");
    expect(copyFragmentShader).toContain("uniform sampler2D tScene");
    expect(copyFragmentShader).toContain("uniform sampler2D tVolume");
  });

  it("uses one coordinate space for normal softening and rejects unsafe temporal reprojection", () => {
    expect(nebulaFragmentShader).toContain("uCameraWorldMatrixInverse");
    expect(nebulaFragmentShader).toContain("vec3 viewRayDirection");
    expect(nebulaFragmentShader).toContain("dot(viewNormal, viewRayDirection)");
    expect(temporalFragmentShader).toContain("uHasDepth");
    expect(temporalFragmentShader).toContain("if (uHasDepth < 0.5)");
    expect(temporalFragmentShader).toContain("previousClip.w > 0.0");
    expect(temporalFragmentShader).toContain("insideNdc");
    expect(temporalFragmentShader).toContain("uPreviousDepth");
    expect(temporalFragmentShader).toContain("depthAgreement");
  });

  it("keeps density intact when no interaction pulse is active", () => {
    expect(nebulaFragmentShader).toContain("float pulseClear = 1.0");
    expect(nebulaFragmentShader).toContain("if (uPulseRadius > 0.0)");
  });
});
