import { describe, expect, it } from "vitest";
import {
  QUALITY_PROFILES,
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
