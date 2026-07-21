import { describe, expect, it } from "vitest";
import { createParticleSeedTexture } from "./particleSeeds";

describe("createParticleSeedTexture", () => {
  it("creates deterministic bounded orbital seeds", () => {
    const first = createParticleSeedTexture(128, 0x51a7);
    const second = createParticleSeedTexture(128, 0x51a7);
    const positions = first.position.image.data as Float32Array;
    const velocities = first.velocity.image.data as Float32Array;
    const energy = first.energy.image.data as Float32Array;

    expect(positions).toEqual(second.position.image.data);
    expect(velocities).toEqual(second.velocity.image.data);
    expect(energy).toEqual(second.energy.image.data);

    for (let index = 0; index < positions.length; index += 4) {
      expect(Math.hypot(positions[index]!, positions[index + 1]!, positions[index + 2]!)).toBeLessThanOrEqual(8);
      expect(Math.hypot(velocities[index]!, velocities[index + 1]!, velocities[index + 2]!)).toBeLessThan(1);
      expect(positions[index + 3]!).toBeGreaterThanOrEqual(0);
      expect(positions[index + 3]!).toBeLessThanOrEqual(1);
    }
  });

  it("allocates one particle per texel at ultra quality", () => {
    const seeds = createParticleSeedTexture(384, 0x51a7);

    expect(seeds.count).toBe(147456);
  });
});
