import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  QUALITY_PROFILES,
  createParticleField,
  lowerQuality,
  selectQualityTier,
} from "./particleField";
import { createConnectionData, createParticleData } from "./particleField";

describe("particle quality", () => {
  it("exposes the approved draw budgets", () => {
    expect(QUALITY_PROFILES).toEqual({
      low: { particles: 3_000, signalNodes: 48, connections: 900 },
      medium: { particles: 6_000, signalNodes: 80, connections: 1_800 },
      high: { particles: 10_000, signalNodes: 128, connections: 3_200 },
    });
  });

  it.each([
    { width: 390, height: 844, ratio: 3, cores: 8, expected: "low" },
    { width: 900, height: 700, ratio: 2, cores: 8, expected: "medium" },
    { width: 1440, height: 900, ratio: 1.5, cores: 12, expected: "high" },
    { width: 1440, height: 900, ratio: 1.5, cores: 4, expected: "low" },
  ] as const)("selects $expected quality", ({ width, height, ratio, cores, expected }) => {
    expect(selectQualityTier(width, height, ratio, cores)).toBe(expected);
  });

  it("only lowers a tier", () => {
    expect(lowerQuality("high")).toBe("medium");
    expect(lowerQuality("medium")).toBe("low");
    expect(lowerQuality("low")).toBe("low");
  });
});

describe("particle data", () => {
  it("creates repeatable tier-ordered attributes", () => {
    const first = createParticleData(10_000, 42);
    const second = createParticleData(10_000, 42);

    expect(first.positions).toEqual(second.positions);
    expect(first.seeds).toEqual(second.seeds);
    expect(first.clusters).toEqual(second.clusters);
    expect(first.levels.slice(0, 3_000).every((value) => value === 0)).toBe(true);
    expect(first.levels.slice(3_000, 6_000).every((value) => value === 1)).toBe(true);
    expect(first.levels.slice(6_000).every((value) => value === 2)).toBe(true);
  });

  it.each([
    { tier: "low", count: 3_000, budget: 900 },
    { tier: "medium", count: 6_000, budget: 1_800 },
    { tier: "high", count: 10_000, budget: 3_200 },
  ] as const)("creates bounded, cluster-local, non-self links for $tier quality", ({ count, budget }) => {
    const particles = createParticleData(count, 42);
    const links = createConnectionData(particles, budget, 91);

    expect(links.indices).toHaveLength(budget * 2);
    expect(links.phases).toHaveLength(budget * 2);
    expect(links.levels).toHaveLength(budget * 2);
    for (let edge = 0; edge < budget; edge += 1) {
      const source = links.indices[edge * 2];
      const target = links.indices[edge * 2 + 1];
      const level = links.levels[edge * 2];
      const particleLimit = [3_000, 6_000, 10_000][level];
      expect(source).toBeLessThan(count);
      expect(target).toBeLessThan(count);
      expect(source).toBeLessThan(particleLimit);
      expect(target).toBeLessThan(particleLimit);
      expect(source).not.toBe(target);
      expect(particles.clusters[source]).toBe(particles.clusters[target]);
      expect(links.phases[edge * 2]).toBe(links.phases[edge * 2 + 1]);
      expect(links.levels[edge * 2]).toBe(links.levels[edge * 2 + 1]);
    }
  });

  it("creates repeatable connection attributes", () => {
    const particles = createParticleData(10_000, 42);
    const first = createConnectionData(particles, 3_200, 91);
    const second = createConnectionData(particles, 3_200, 91);

    expect(first.indices).toEqual(second.indices);
    expect(first.phases).toEqual(second.phases);
    expect(first.levels).toEqual(second.levels);
  });
});

describe("particle render field", () => {
  it("creates one points field, one instanced signal mesh, and one line batch", () => {
    const field = createParticleField("high");

    expect(field.group.children).toHaveLength(3);
    expect(field.group.children[0]).toBeInstanceOf(THREE.Points);
    expect((field.group.children[1] as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.InstancedBufferGeometry,
    );
    expect(field.group.children[2]).toBeInstanceOf(THREE.LineSegments);
    expect(field.group.children.every((child) => !child.frustumCulled)).toBe(true);

    field.dispose();
  });

  it("builds tier-ordered attributes from the full high-quality buffers", () => {
    const field = createParticleField("high");
    const ambient = field.group.children[0] as THREE.Points;
    const signals = field.group.children[1] as THREE.Mesh<THREE.InstancedBufferGeometry>;
    const connections = field.group.children[2] as THREE.LineSegments;
    const particles = createParticleData(10_000, 0x51a7);
    const connectionData = createConnectionData(particles, 3_200, 0xc011);
    const signalIndices = [
      ...Array.from({ length: 48 }, (_, index) => index),
      ...Array.from({ length: 32 }, (_, index) => 3_000 + index),
      ...Array.from({ length: 48 }, (_, index) => 6_000 + index),
    ];
    const expectedAnchors = new Float32Array(signalIndices.length * 3);
    const expectedSignalSeeds = new Float32Array(signalIndices.length * 4);
    signalIndices.forEach((particleIndex, signalIndex) => {
      expectedAnchors.set(
        particles.positions.subarray(particleIndex * 3, particleIndex * 3 + 3),
        signalIndex * 3,
      );
      expectedSignalSeeds.set(
        particles.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4),
        signalIndex * 4,
      );
    });
    const expectedEndpointPositions = new Float32Array(connectionData.indices.length * 3);
    const expectedEndpointSeeds = new Float32Array(connectionData.indices.length * 4);
    connectionData.indices.forEach((particleIndex, endpointIndex) => {
      expectedEndpointPositions.set(
        particles.positions.subarray(particleIndex * 3, particleIndex * 3 + 3),
        endpointIndex * 3,
      );
      expectedEndpointSeeds.set(
        particles.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4),
        endpointIndex * 4,
      );
    });

    expect(ambient.geometry.getAttribute("position").count).toBe(10_000);
    expect(ambient.geometry.getAttribute("aSeed").itemSize).toBe(4);
    expect(ambient.geometry.getAttribute("aLevel").array).toEqual(particles.levels);
    const anchorAttribute = signals.geometry.getAttribute("aAnchor");
    const signalSeedAttribute = signals.geometry.getAttribute("aSignalSeed");
    expect(anchorAttribute).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(anchorAttribute.count).toBe(128);
    expect(anchorAttribute.itemSize).toBe(3);
    expect(anchorAttribute.array).toEqual(expectedAnchors);
    expect(signalSeedAttribute).toBeInstanceOf(THREE.InstancedBufferAttribute);
    expect(signalSeedAttribute.itemSize).toBe(4);
    expect(signalSeedAttribute.array).toEqual(expectedSignalSeeds);
    expect(Array.from(signals.geometry.getAttribute("aLevel").array)).toEqual([
      ...Array(48).fill(0),
      ...Array(32).fill(1),
      ...Array(48).fill(2),
    ]);
    expect(connections.geometry.getAttribute("position").count).toBe(6_400);
    expect(connections.geometry.getAttribute("position").array).toEqual(expectedEndpointPositions);
    const endpointAttribute = connections.geometry.getAttribute("aEndpoint");
    const endpointSeedAttribute = connections.geometry.getAttribute("aEndpointSeed");
    const edgePhaseAttribute = connections.geometry.getAttribute("aEdgePhase");
    const connectionLevelAttribute = connections.geometry.getAttribute("aLevel");
    expect(endpointAttribute.itemSize).toBe(3);
    expect(endpointAttribute.array).toEqual(expectedEndpointPositions);
    expect(endpointSeedAttribute.itemSize).toBe(4);
    expect(endpointSeedAttribute.array).toEqual(expectedEndpointSeeds);
    expect(edgePhaseAttribute.itemSize).toBe(1);
    expect(edgePhaseAttribute.array).toEqual(connectionData.phases);
    expect(connectionLevelAttribute.itemSize).toBe(1);
    expect(connectionLevelAttribute.array).toEqual(connectionData.levels);

    field.dispose();
  });

  it("owns independent copies of the signal quad buffers", () => {
    let sourceIndex: THREE.BufferAttribute | null = null;
    let sourceAttributes: Record<
      string,
      THREE.BufferAttribute | THREE.InterleavedBufferAttribute
    > = {};
    const originalDispose = THREE.PlaneGeometry.prototype.dispose;
    const disposeSpy = vi
      .spyOn(THREE.PlaneGeometry.prototype, "dispose")
      .mockImplementation(function (this: THREE.PlaneGeometry) {
        sourceIndex = this.getIndex();
        sourceAttributes = { ...this.attributes };
        originalDispose.call(this);
      });

    const field = createParticleField("high");
    disposeSpy.mockRestore();
    const signals = field.group.children[1] as THREE.Mesh<THREE.InstancedBufferGeometry>;
    const reference = new THREE.PlaneGeometry(2, 2);
    const signalIndex = signals.geometry.getIndex();
    const capturedIndex = sourceIndex as THREE.BufferAttribute | null;

    expect(signalIndex).not.toBeNull();
    expect(signalIndex).not.toBe(capturedIndex);
    expect(signalIndex?.array).not.toBe(capturedIndex?.array);
    expect(signalIndex?.count).toBe(6);
    expect(signalIndex?.itemSize).toBe(1);
    expect(signalIndex?.array).toEqual(reference.getIndex()?.array);
    for (const name of ["position", "normal", "uv"]) {
      const attribute = signals.geometry.getAttribute(name);
      const referenceAttribute = reference.getAttribute(name);
      expect(attribute).toBeDefined();
      expect(attribute).not.toBe(sourceAttributes[name]);
      expect(attribute.array).not.toBe(sourceAttributes[name].array);
      expect(attribute.count).toBe(referenceAttribute.count);
      expect(attribute.itemSize).toBe(referenceAttribute.itemSize);
      expect(attribute.array).toEqual(referenceAttribute.array);
    }

    reference.dispose();
    field.dispose();
  });

  it("applies exact draw budgets for each quality tier", () => {
    const field = createParticleField("high");
    const ambient = field.group.children[0] as THREE.Points;
    const signals = field.group.children[1] as THREE.Mesh<THREE.InstancedBufferGeometry>;
    const connections = field.group.children[2] as THREE.LineSegments;

    expect(ambient.geometry.drawRange.count).toBe(10_000);
    expect(signals.geometry.instanceCount).toBe(128);
    expect(connections.geometry.drawRange.count).toBe(6_400);
    field.setQuality("medium");
    expect(ambient.geometry.drawRange.count).toBe(6_000);
    expect(signals.geometry.instanceCount).toBe(80);
    expect(connections.geometry.drawRange.count).toBe(3_600);
    field.setQuality("low");
    expect(ambient.geometry.drawRange.count).toBe(3_000);
    expect(signals.geometry.instanceCount).toBe(48);
    expect(connections.geometry.drawRange.count).toBe(1_800);
    field.setQuality("high");
    expect(ambient.geometry.drawRange.count).toBe(10_000);
    expect(signals.geometry.instanceCount).toBe(128);
    expect(connections.geometry.drawRange.count).toBe(6_400);

    field.dispose();
  });

  it("configures all materials for additive transparent rendering", () => {
    const field = createParticleField("high");
    const materials = field.group.children.map(
      (child) => (child as THREE.Points | THREE.Mesh | THREE.LineSegments).material,
    ) as THREE.ShaderMaterial[];

    for (const material of materials) {
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.toneMapped).toBe(false);
      expect(material.blending).toBe(THREE.AdditiveBlending);
    }

    field.dispose();
  });

  it("updates shared motion, palette, and quality uniforms", () => {
    const field = createParticleField("high");
    const materials = field.group.children.map(
      (child) => (child as THREE.Points | THREE.Mesh | THREE.LineSegments).material,
    ) as THREE.ShaderMaterial[];

    field.setTime(4.5);
    field.setPointer(120, -80, 0.7);
    field.setContentMask(0.4, 0.6, 0.2, 0.3);
    field.setQualityMix(1.4);
    field.setColors({ particle: "#aaaaaa", signal: "#ffffff", connection: "#777777" });
    field.setBlendMode("normal");

    for (const material of materials) {
      expect(material.uniforms.uTime.value).toBe(4.5);
      expect(material.uniforms.uPointer.value).toEqual(new THREE.Vector3(120, -80, 0));
      expect(material.uniforms.uPointerSpeed.value).toBe(0.7);
      expect(material.uniforms.uContentMask.value).toEqual(new THREE.Vector4(0.4, 0.6, 0.2, 0.3));
      expect(material.uniforms.uQualityMix.value).toBe(1.4);
      expect(material.blending).toBe(THREE.NormalBlending);
    }
    expect(materials[0].uniforms.uTime).toBe(materials[1].uniforms.uTime);
    expect(materials[1].uniforms.uTime).toBe(materials[2].uniforms.uTime);
    expect(materials[0].uniforms.uParticleColor.value).toEqual(new THREE.Color("#aaaaaa"));
    expect(materials[1].uniforms.uSignalColor.value).toEqual(new THREE.Color("#ffffff"));
    expect(materials[2].uniforms.uConnectionColor.value).toEqual(new THREE.Color("#777777"));

    field.dispose();
  });

  it("disposes each geometry and material once", () => {
    const field = createParticleField("high");
    const resources = field.group.children.flatMap((child) => {
      const renderable = child as THREE.Points | THREE.Mesh | THREE.LineSegments;
      return [renderable.geometry, renderable.material];
    }) as Array<{ dispose(): void }>;
    const spies = resources.map((resource) => vi.spyOn(resource, "dispose"));

    field.dispose();
    field.dispose();

    expect(field.group.children).toHaveLength(0);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });
});
