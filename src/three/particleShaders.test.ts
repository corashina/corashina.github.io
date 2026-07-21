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
  it("builds coordinated motion from two finite-difference curl layers", () => {
    expect(ambientVertexShader).toContain("attribute vec4 aSeed");
    expect(ambientVertexShader).toContain("attribute float aLevel");
    expect(ambientVertexShader).toContain("vec3 flowPotential(");
    expect(ambientVertexShader).toContain("vec3 curlFlow(");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition + xOffset, phase)");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition - xOffset, phase)");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition + yOffset, phase)");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition - yOffset, phase)");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition + zOffset, phase)");
    expect(ambientVertexShader).toContain("flowPotential(samplePosition - zOffset, phase)");
    expect(ambientVertexShader).toContain("float dAzDy =");
    expect(ambientVertexShader).toContain("float dAyDz =");
    expect(ambientVertexShader).toContain("float dAxDz =");
    expect(ambientVertexShader).toContain("float dAzDx =");
    expect(ambientVertexShader).toContain("float dAyDx =");
    expect(ambientVertexShader).toContain("float dAxDy =");
    expect(ambientVertexShader).toContain("return vec3(dAzDy - dAyDz, dAxDz - dAzDx, dAyDx - dAxDy)");
    expect(ambientVertexShader).toContain("vec3 lowFlowPoint = base * 0.00115");
    expect(ambientVertexShader).toContain("vec3 detailFlowPoint = base * 0.00345");
    expect(ambientVertexShader).toMatch(
      /vec3 lowFrequencyCurl = curlFlow\(\s*lowFlowPoint,/,
    );
    expect(ambientVertexShader).toMatch(/vec3 detailCurl = curlFlow\(\s*detailFlowPoint,/);
    expect(ambientVertexShader).toMatch(
      /vec3 drift = lowFrequencyCurl \* [\d.]+ \+ detailCurl \* [\d.]+;/,
    );
    expect(ambientVertexShader).not.toContain("float clusterWave =");
    expect(ambientVertexShader).not.toContain("float crossWave =");
    expect(ambientVertexShader).toContain("uPointerSpeed");
    expect(ambientVertexShader).toContain("uContentMask");
    expect(ambientFragmentShader).toContain("gl_PointCoord");
    expect(ambientVertexShader).toContain("uQualityMix");
  });

  it("forms, breathes, dissolves, and seamlessly reforms migrating clusters", () => {
    expect(ambientVertexShader).toContain("float clusterLifetime(vec4 seed)");
    expect(ambientVertexShader).toContain(
      "float clusterIdentity = floor(seed.w * 23.0 + 0.5) / 24.0",
    );
    expect(ambientVertexShader).toContain("float clusterCycle = fract(");
    expect(ambientVertexShader).toContain("uTime * 0.018 + clusterIdentity");
    expect(ambientVertexShader).toContain("float formation = smoothstep(0.0, 0.18, clusterCycle)");
    expect(ambientVertexShader).toContain(
      "float dissolution = 1.0 - smoothstep(0.68, 1.0, clusterCycle)",
    );
    expect(ambientVertexShader).toContain("return formation * dissolution");
    expect(ambientVertexShader).toContain("vec2 migratingCenter = clusterCenter +");
    expect(ambientVertexShader).toContain("float clusterBreath =");
    expect(ambientVertexShader).toContain("float lifetime = clusterLifetime(seed)");
    expect(ambientVertexShader).toContain(
      "clusteredPosition.xy = migratingCenter + (base.xy - clusterCenter) * clusterBreath",
    );
    expect(ambientVertexShader).toContain("drift += (clusteredPosition - base) * lifetime");
    expect(ambientVertexShader).toContain(
      "float lifetimeVisibility = clusterLifetime(aSeed)",
    );
    expect(ambientVertexShader).toContain(
      "vAlpha = contentVisibility(screen) * tierAlpha * lifetimeVisibility",
    );
    expect(signalVertexShader).toContain(
      "float lifetimeVisibility = clusterLifetime(aSignalSeed)",
    );
    expect(connectionVertexShader).toContain(
      "float lifetimeVisibility = clusterLifetime(aEndpointSeed)",
    );
  });

  it("keeps ambient particles, signal anchors, and connection endpoints attached", () => {
    expect(ambientVertexShader).toContain("displacedPosition(position, aSeed)");
    expect(signalVertexShader).toContain("displacedPosition(aAnchor, aSignalSeed)");
    expect(connectionVertexShader).toContain(
      "displacedPosition(aEndpoint, aEndpointSeed)",
    );
    for (const shader of [ambientVertexShader, signalVertexShader, connectionVertexShader]) {
      expect(shader).toContain("vec3 displacedPosition(vec3 base, vec4 seed)");
      expect(shader).toContain("vec3 lowFrequencyCurl = curlFlow(");
      expect(shader).toContain("float lifetime = clusterLifetime(seed)");
    }
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
