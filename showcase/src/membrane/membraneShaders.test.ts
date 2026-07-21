import { describe, expect, it } from "vitest";
import { membraneComputeShader, membraneFragmentShader, membraneVertexShader } from "./membraneShaders";

describe("membrane compute shader", () => {
  it("propagates bounded height and velocity across four neighbours with pulse and particle impacts", () => {
    expect(membraneComputeShader).toContain("north");
    expect(membraneComputeShader).toContain("south");
    expect(membraneComputeShader).toContain("east");
    expect(membraneComputeShader).toContain("west");
    expect(membraneComputeShader).toContain("laplacian");
    expect(membraneComputeShader).toContain("uWaveSpeed");
    expect(membraneComputeShader).toContain("exp(-uDamping * uDelta)");
    expect(membraneComputeShader).toContain("pulse");
    expect(membraneComputeShader).toContain("clamp(center + velocity * uDelta + pulse + impacts, -0.65, 0.65)");
    expect(membraneComputeShader).toContain("gl_FragColor = vec4(height, velocity");
  });

  it("samples exactly eight fixed particle texture coordinates", () => {
    expect(membraneComputeShader).toContain("uParticleSamples[8]");
    expect((membraneComputeShader.match(/texture2D\(uParticleTexture, uParticleSamples\[/g) ?? [])).toHaveLength(8);
    expect(membraneComputeShader).toContain("particle.xz");
    expect(membraneComputeShader).toContain("abs(particle.y - uMembraneY)");
  });
});

describe("membrane render shaders", () => {
  it("displaces from the live height texture and reconstructs finite-difference normals", () => {
    expect(membraneVertexShader).toContain("uHeightTexture");
    expect(membraneVertexShader).toContain("texture2D");
    expect(membraneVertexShader).toContain("vec3(0.0, 0.0, height)");
    expect(membraneVertexShader).toContain("uTexel");
    expect(membraneVertexShader).toContain("uWorldTexel");
    expect(membraneVertexShader).toContain("2.0 * uWorldTexel");
    expect(membraneVertexShader).toContain("heightEast");
    expect(membraneVertexShader).toContain("heightWest");
    expect(membraneVertexShader).toContain("heightNorth");
    expect(membraneVertexShader).toContain("heightSouth");
    expect(membraneVertexShader).toContain("cross");
  });

  it("uses a cyan curvature response over physical roughness, Fresnel, and environment lighting", () => {
    expect(membraneFragmentShader).toContain("fresnel");
    expect(membraneFragmentShader).toContain("roughness");
    expect(membraneFragmentShader).toContain("environment");
    expect(membraneFragmentShader).toContain("cyan");
    expect(membraneFragmentShader).toContain("curvature");
    expect(membraneFragmentShader).toContain("cameraPosition");
  });
});
