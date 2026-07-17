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

  it("creates the requested number of cluster-local, non-self links", () => {
    const particles = createParticleData(10_000, 42);
    const links = createConnectionData(particles, 3_200, 91);

    expect(links.indices).toHaveLength(6_400);
    expect(links.phases).toHaveLength(6_400);
    expect(links.levels).toHaveLength(6_400);
    for (let edge = 0; edge < 3_200; edge += 1) {
      const source = links.indices[edge * 2];
      const target = links.indices[edge * 2 + 1];
      const level = links.levels[edge * 2];
      const particleLimit = [3_000, 6_000, 10_000][level];
      expect(source).toBeLessThan(10_000);
      expect(target).toBeLessThan(10_000);
      expect(source).toBeLessThan(particleLimit);
      expect(target).toBeLessThan(particleLimit);
      expect(source).not.toBe(target);
      expect(particles.clusters[source]).toBe(particles.clusters[target]);
    }
  });
});
