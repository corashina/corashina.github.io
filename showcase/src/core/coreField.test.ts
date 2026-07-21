import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { applyMetaballs, sampleMetaballs } from "./coreField";

describe("sampleMetaballs", () => {
  it("returns six repeatable sources with bounded radii", () => {
    const first = sampleMetaballs(3.25, 0.4, false);
    const second = sampleMetaballs(3.25, 0.4, false);

    expect(first).toHaveLength(6);
    expect(second).toEqual(first);
    for (const source of first) {
      expect(source.radius).toBeGreaterThanOrEqual(0.12);
      expect(source.radius).toBeLessThanOrEqual(0.42);
    }
  });

  it("moves the source orbit outward as pulse energy increases", () => {
    const atRest = sampleMetaballs(1.75, 0, false);
    const energized = sampleMetaballs(1.75, 1, false);
    const distance = ({ x, y, z }: { x: number; y: number; z: number }) => Math.hypot(x, y, z);

    expect(energized.every((source, index) => distance(source) > distance(atRest[index]!))).toBe(true);
  });

  it("adds only a bounded outward displacement on release", () => {
    const orbiting = sampleMetaballs(0.8, 0.7, false);
    const released = sampleMetaballs(0.8, 0.7, true);

    for (let index = 0; index < orbiting.length; index += 1) {
      const displacement = Math.hypot(
        released[index]!.x - orbiting[index]!.x,
        released[index]!.y - orbiting[index]!.y,
        released[index]!.z - orbiting[index]!.z,
      );
      expect(displacement).toBeGreaterThan(0);
      expect(displacement).toBeLessThanOrEqual(0.061);
    }
  });
});

describe("applyMetaballs", () => {
  it("resets, applies normalized field balls, and updates the marching surface", () => {
    const effect = {
      reset: vi.fn(),
      addBall: vi.fn(),
      update: vi.fn(),
    };
    const source = sampleMetaballs(0, 0.5, false)[0]!;

    applyMetaballs(effect, [source]);

    expect(effect.reset).toHaveBeenCalledTimes(1);
    expect(effect.addBall).toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), expect.any(Number), 0.72 + 0.5 * 0.24, 12, expect.any(THREE.Color),
    );
    const [x, y, z] = effect.addBall.mock.calls[0]!;
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(1);
    expect(z).toBeGreaterThanOrEqual(0);
    expect(z).toBeLessThanOrEqual(1);
    expect(effect.update).toHaveBeenCalledTimes(1);
  });
});
