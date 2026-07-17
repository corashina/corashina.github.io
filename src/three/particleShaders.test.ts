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
  });

  it("moves and pulses bounded connection endpoints", () => {
    expect(connectionVertexShader).toContain("attribute vec3 aEndpoint");
    expect(connectionVertexShader).toContain("attribute vec4 aEndpointSeed");
    expect(connectionVertexShader).toContain("attribute float aEdgePhase");
    expect(connectionFragmentShader).toContain("vSignal");
  });
});
