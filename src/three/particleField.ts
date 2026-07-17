import * as THREE from "three";
import {
  ambientFragmentShader,
  ambientVertexShader,
  connectionFragmentShader,
  connectionVertexShader,
  signalFragmentShader,
  signalVertexShader,
} from "./particleShaders";

export type QualityTier = "low" | "medium" | "high";

export type QualityProfile = {
  particles: number;
  signalNodes: number;
  connections: number;
};

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: { particles: 3_000, signalNodes: 48, connections: 900 },
  medium: { particles: 6_000, signalNodes: 80, connections: 1_800 },
  high: { particles: 10_000, signalNodes: 128, connections: 3_200 },
};

export function selectQualityTier(
  width: number,
  height: number,
  pixelRatio: number,
  hardwareConcurrency: number,
): QualityTier {
  const pixels = width * height * Math.min(Math.max(pixelRatio, 1), 2);
  if (width < 640 || hardwareConcurrency <= 4 || pixels > 4_800_000) return "low";
  if (width < 1_200 || hardwareConcurrency <= 8 || pixels > 2_600_000) return "medium";
  return "high";
}

export function lowerQuality(tier: QualityTier): QualityTier {
  if (tier === "high") return "medium";
  if (tier === "medium") return "low";
  return "low";
}

export type ParticleData = {
  positions: Float32Array;
  seeds: Float32Array;
  clusters: Uint8Array;
  levels: Uint8Array;
};

export type ConnectionData = {
  indices: Uint32Array;
  phases: Float32Array;
  levels: Uint8Array;
};

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createParticleData(count: number, seed: number): ParticleData {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const clusters = new Uint8Array(count);
  const levels = new Uint8Array(count);

  for (let index = 0; index < count; index += 1) {
    const cluster = Math.floor(random() * 24);
    const clusterAngle = (cluster / 24) * Math.PI * 2;
    const clusterRadius = 180 + (cluster % 6) * 220;
    const centerX = Math.cos(clusterAngle) * clusterRadius;
    const centerY = Math.sin(clusterAngle) * clusterRadius * 0.58;
    const jitterRadius = Math.sqrt(random()) * (130 + (cluster % 4) * 28);
    const jitterAngle = random() * Math.PI * 2;
    positions[index * 3] = centerX + Math.cos(jitterAngle) * jitterRadius;
    positions[index * 3 + 1] = centerY + Math.sin(jitterAngle) * jitterRadius;
    positions[index * 3 + 2] = (random() - 0.5) * 900;
    seeds.set([random(), random(), 0.55 + random() * 1.45, cluster / 23], index * 4);
    clusters[index] = cluster;
    levels[index] = index < 3_000 ? 0 : index < 6_000 ? 1 : 2;
  }

  return { positions, seeds, clusters, levels };
}

export function createConnectionData(
  particles: ParticleData,
  budget: number,
  seed: number,
): ConnectionData {
  const random = mulberry32(seed);
  const tierLimits = [
    QUALITY_PROFILES.low.particles,
    QUALITY_PROFILES.medium.particles,
    QUALITY_PROFILES.high.particles,
  ];
  const membersByLevel = tierLimits.map((limit) => {
    const groups = Array.from({ length: 24 }, () => [] as number[]);
    const availableLimit = Math.min(limit, particles.clusters.length);
    for (let index = 0; index < availableLimit; index += 1) {
      groups[particles.clusters[index]].push(index);
    }
    return groups;
  });
  const indices = new Uint32Array(budget * 2);
  const phases = new Float32Array(budget * 2);
  const levels = new Uint8Array(budget * 2);

  for (let edge = 0; edge < budget; edge += 1) {
    const level = edge < 900 ? 0 : edge < 1_800 ? 1 : 2;
    const groups = membersByLevel[level];
    const group = groups[edge % groups.length];
    const sourceOffset = Math.floor(random() * group.length);
    const distance = 1 + Math.floor(random() * Math.min(12, group.length - 1));
    const source = group[sourceOffset];
    const target = group[(sourceOffset + distance) % group.length];
    const phase = random();
    indices.set([source, target], edge * 2);
    phases.set([phase, phase], edge * 2);
    levels.set([level, level], edge * 2);
  }

  return { indices, phases, levels };
}

export type ParticlePalette = {
  particle: THREE.ColorRepresentation;
  signal: THREE.ColorRepresentation;
  connection: THREE.ColorRepresentation;
};

export type ParticleBlendMode = "additive" | "normal";

export type ParticleFieldController = {
  group: THREE.Group;
  setTime(value: number): void;
  setPointer(x: number, y: number, speed: number): void;
  setContentMask(x: number, y: number, width: number, height: number): void;
  setColors(colors: ParticlePalette): void;
  setBlendMode(mode: ParticleBlendMode): void;
  setQuality(tier: QualityTier): void;
  setQualityMix(value: number): void;
  dispose(): void;
};

export function createParticleField(initialTier: QualityTier): ParticleFieldController {
  const particleData = createParticleData(QUALITY_PROFILES.high.particles, 0x51a7);
  const connectionData = createConnectionData(
    particleData,
    QUALITY_PROFILES.high.connections,
    0xc011,
  );
  const time = { value: 0 };
  const pointer = { value: new THREE.Vector3() };
  const pointerSpeed = { value: 0 };
  const contentMask = { value: new THREE.Vector4(0.5, 0.5, 0.24, 0.38) };
  const qualityMix = {
    value: initialTier === "high" ? 2 : initialTier === "medium" ? 1 : 0,
  };
  const particleColor = { value: new THREE.Color("#aeb4ba") };
  const signalColor = { value: new THREE.Color("#f4f6f7") };
  const connectionColor = { value: new THREE.Color("#697078") };
  const motionUniforms = {
    uTime: time,
    uPointer: pointer,
    uPointerSpeed: pointerSpeed,
    uContentMask: contentMask,
    uQualityMix: qualityMix,
  };

  const ambientGeometry = new THREE.BufferGeometry();
  ambientGeometry.setAttribute("position", new THREE.BufferAttribute(particleData.positions, 3));
  ambientGeometry.setAttribute("aSeed", new THREE.BufferAttribute(particleData.seeds, 4));
  ambientGeometry.setAttribute("aLevel", new THREE.BufferAttribute(particleData.levels, 1));
  const ambientMaterial = new THREE.ShaderMaterial({
    vertexShader: ambientVertexShader,
    fragmentShader: ambientFragmentShader,
    uniforms: { ...motionUniforms, uParticleColor: particleColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const ambient = new THREE.Points(ambientGeometry, ambientMaterial);
  ambient.frustumCulled = false;

  const signalIndices = [
    ...Array.from({ length: 48 }, (_, index) => index),
    ...Array.from({ length: 32 }, (_, index) => 3_000 + index),
    ...Array.from({ length: 48 }, (_, index) => 6_000 + index),
  ];
  const anchors = new Float32Array(signalIndices.length * 3);
  const signalSeeds = new Float32Array(signalIndices.length * 4);
  const signalLevels = new Uint8Array(signalIndices.length);
  signalIndices.forEach((particleIndex, signalIndex) => {
    anchors.set(
      particleData.positions.subarray(particleIndex * 3, particleIndex * 3 + 3),
      signalIndex * 3,
    );
    signalSeeds.set(
      particleData.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4),
      signalIndex * 4,
    );
    signalLevels[signalIndex] = signalIndex < 48 ? 0 : signalIndex < 80 ? 1 : 2;
  });

  const quad = new THREE.PlaneGeometry(2, 2);
  const signalGeometry = new THREE.InstancedBufferGeometry();
  signalGeometry.setIndex(quad.getIndex()?.clone() ?? null);
  Object.entries(quad.attributes).forEach(([name, attribute]) => {
    signalGeometry.setAttribute(name, attribute.clone());
  });
  quad.dispose();
  signalGeometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchors, 3));
  signalGeometry.setAttribute("aSignalSeed", new THREE.InstancedBufferAttribute(signalSeeds, 4));
  signalGeometry.setAttribute("aLevel", new THREE.InstancedBufferAttribute(signalLevels, 1));
  const signalMaterial = new THREE.ShaderMaterial({
    vertexShader: signalVertexShader,
    fragmentShader: signalFragmentShader,
    uniforms: { ...motionUniforms, uSignalColor: signalColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const signals = new THREE.Mesh(signalGeometry, signalMaterial);
  signals.frustumCulled = false;

  const endpointPositions = new Float32Array(connectionData.indices.length * 3);
  const endpointSeeds = new Float32Array(connectionData.indices.length * 4);
  connectionData.indices.forEach((particleIndex, endpointIndex) => {
    endpointPositions.set(
      particleData.positions.subarray(particleIndex * 3, particleIndex * 3 + 3),
      endpointIndex * 3,
    );
    endpointSeeds.set(
      particleData.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4),
      endpointIndex * 4,
    );
  });
  const connectionGeometry = new THREE.BufferGeometry();
  connectionGeometry.setAttribute("position", new THREE.BufferAttribute(endpointPositions, 3));
  connectionGeometry.setAttribute(
    "aEndpoint",
    new THREE.BufferAttribute(endpointPositions, 3),
  );
  connectionGeometry.setAttribute(
    "aEndpointSeed",
    new THREE.BufferAttribute(endpointSeeds, 4),
  );
  connectionGeometry.setAttribute(
    "aEdgePhase",
    new THREE.BufferAttribute(connectionData.phases, 1),
  );
  connectionGeometry.setAttribute(
    "aLevel",
    new THREE.BufferAttribute(connectionData.levels, 1),
  );
  const connectionMaterial = new THREE.ShaderMaterial({
    vertexShader: connectionVertexShader,
    fragmentShader: connectionFragmentShader,
    uniforms: { ...motionUniforms, uConnectionColor: connectionColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const connections = new THREE.LineSegments(connectionGeometry, connectionMaterial);
  connections.frustumCulled = false;

  const group = new THREE.Group();
  group.add(ambient, signals, connections);
  const materials = [ambientMaterial, signalMaterial, connectionMaterial];
  let disposed = false;

  const applyQuality = (profile: QualityProfile): void => {
    ambientGeometry.setDrawRange(0, profile.particles);
    signalGeometry.instanceCount = profile.signalNodes;
    connectionGeometry.setDrawRange(0, profile.connections * 2);
  };
  applyQuality(QUALITY_PROFILES[initialTier]);

  return {
    group,
    setTime: (value) => {
      time.value = value;
    },
    setPointer: (x, y, speed) => {
      pointer.value.set(x, y, 0);
      pointerSpeed.value = speed;
    },
    setContentMask: (x, y, width, height) => {
      contentMask.value.set(x, y, width, height);
    },
    setColors: (colors) => {
      particleColor.value.set(colors.particle);
      signalColor.value.set(colors.signal);
      connectionColor.value.set(colors.connection);
    },
    setBlendMode: (mode) => {
      const blending = mode === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
      materials.forEach((material) => {
        material.blending = blending;
        material.needsUpdate = true;
      });
    },
    setQuality: (tier) => {
      applyQuality(QUALITY_PROFILES[tier]);
    },
    setQualityMix: (value) => {
      qualityMix.value = value;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.remove(ambient, signals, connections);
      ambientGeometry.dispose();
      signalGeometry.dispose();
      connectionGeometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}
