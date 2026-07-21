import { describe, expect, it } from "vitest";
import { particleFragmentShader, particlePositionShader, particleVelocityShader, particleVertexShader } from "./particleShaders";

describe("particle compute shaders", () => {
  it("contains the bounded orbital interaction contract", () => {
    expect(particleVelocityShader).toContain("texturePosition");
    expect(particleVelocityShader).toContain("textureVelocity");
    expect(particleVelocityShader).toContain("orbital");
    expect(particleVelocityShader).toContain("curl");
    expect(particleVelocityShader).toContain("pointerForce");
    expect(particleVelocityShader).toContain("pulseForce");
    expect(particleVelocityShader).toContain("clampLength");
    expect(particleVelocityShader).toContain("uTurbulence");
    expect(particleVelocityShader).toContain("uDrag");
    expect(particleVelocityShader).toContain("exp(-uDelta * 0.18)");
  });

  it("integrates velocity and wraps escaped particles", () => {
    expect(particlePositionShader).toContain("textureVelocity");
    expect(particlePositionShader).toContain("uDelta");
    expect(particlePositionShader).toContain("length(position.xyz) > 12.0");
    expect(particlePositionShader).toContain("position.w");
  });
});

describe("particle render shaders", () => {
  it("samples computed positions and shades energy phases as soft points", () => {
    expect(particleVertexShader).toContain("texturePosition");
    expect(particleVertexShader).toContain("texture2D");
    expect(particleFragmentShader).toContain("cyan");
    expect(particleFragmentShader).toContain("violet");
    expect(particleFragmentShader).toContain("gold");
    expect(particleFragmentShader).toContain("gl_PointCoord");
  });
});
