import { describe, expect, it } from "vitest";
import { MAX_PIXEL_RATIO, PARTICLE_COUNT, PARTICLE_TEXTURE_SIZE } from "./particleConfig";

describe("particleConfig", () => {
  it("fixes the showcase to the approved low particle budget", () => {
    expect(PARTICLE_TEXTURE_SIZE).toBe(128);
    expect(PARTICLE_COUNT).toBe(128 * 128);
    expect(MAX_PIXEL_RATIO).toBe(1);
  });
});
