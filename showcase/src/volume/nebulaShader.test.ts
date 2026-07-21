import { describe, expect, it } from "vitest";
import { nebulaFragmentShader } from "./nebulaShader";

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
});
