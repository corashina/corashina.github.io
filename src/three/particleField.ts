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
    for (let index = 0; index < limit; index += 1) {
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
