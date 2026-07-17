import { describe, expect, it } from "vitest";
import {
  ambientFragmentShader,
  ambientVertexShader,
  connectionFragmentShader,
  connectionVertexShader,
  signalFragmentShader,
  signalVertexShader,
} from "./particleShaders";

describe("constellation shaders", () => {
  it("moves ambient particles through a pointer-reactive cluster field", () => {
    expect(ambientVertexShader).toContain("attribute vec4 aSeed");
    expect(ambientVertexShader).toContain("attribute float aLevel");
    expect(ambientVertexShader).toContain("displacedPosition");
    expect(ambientVertexShader).toContain("uPointerSpeed");
    expect(ambientVertexShader).toContain("uContentMask");
    expect(ambientFragmentShader).toContain("gl_PointCoord");
    expect(ambientVertexShader).toContain("uQualityMix");
  });

  it("renders instanced signal halos with stretched trails", () => {
    expect(signalVertexShader).toContain("attribute vec3 aAnchor");
    expect(signalVertexShader).toContain("attribute vec4 aSignalSeed");
    expect(signalVertexShader).toContain("uPointerSpeed");
    expect(signalFragmentShader).toContain("vEnergy");
    expect(signalFragmentShader).toContain("vTrail");
    expect(signalFragmentShader).toContain("1.0 - smoothstep(0.0, 0.52, vUv.x)");
    expect(signalFragmentShader).not.toContain("smoothstep(0.52, 0.0, vUv.x)");
  });

  it("moves bounded connection endpoints and propagates pointer-reactive pulses", () => {
    expect(connectionVertexShader).toContain("attribute vec3 aEndpoint");
    expect(connectionVertexShader).toContain("attribute vec4 aEndpointSeed");
    expect(connectionVertexShader).toContain("attribute float aEdgePhase");
    expect(connectionVertexShader).toContain("attribute float aEndpointCoordinate");
    expect(connectionVertexShader).toContain("attribute vec4 aEdgeMeta");
    expect(connectionVertexShader).toContain("aEdgeMeta.x");
    expect(connectionVertexShader).toContain("aEdgeMeta.y");
    expect(connectionVertexShader).toContain("aEdgeMeta.z");
    expect(connectionVertexShader).toContain("aEdgeMeta.w");
    expect(connectionVertexShader).toContain(
      "vEndpointCoordinate = aEndpointCoordinate",
    );
    expect(connectionVertexShader).toContain("varying float vVisibility");
    expect(connectionFragmentShader).toContain("uniform float uPointerSpeed");
    expect(connectionFragmentShader).toContain("fract(");
    expect(connectionFragmentShader).toContain("clamp(uPointerSpeed, 0.0, 1.0)");
    expect(connectionFragmentShader).toContain("clamp(");
    expect(connectionFragmentShader).toContain("varying float vVisibility");
  });
});
