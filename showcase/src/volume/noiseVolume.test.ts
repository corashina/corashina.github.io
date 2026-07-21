import { describe, expect, it } from "vitest";
import { createNoiseVolume } from "./noiseVolume";

describe("createNoiseVolume", () => {
  it("creates deterministic seamless four-octave density data", () => {
    const first = createNoiseVolume(32, 0xc051c);
    const second = createNoiseVolume(32, 0xc051c);
    const firstData = first.image.data as Uint8Array;
    const secondData = second.image.data as Uint8Array;

    expect(firstData).toEqual(secondData);
    expect(firstData).toHaveLength(32 ** 3);
    expect(Math.min(...firstData)).toBeLessThan(32);
    expect(Math.max(...firstData)).toBeGreaterThan(220);

    for (let y = 0; y < 32; y += 1) {
      for (let z = 0; z < 32; z += 1) {
        expect(firstData[z * 32 * 32 + y * 32]).toBe(firstData[z * 32 * 32 + y * 32 + 31]);
      }
    }
  });
});
