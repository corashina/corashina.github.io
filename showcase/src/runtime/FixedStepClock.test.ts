import { describe, expect, it, vi } from "vitest";
import { FixedStepClock } from "./FixedStepClock";

describe("FixedStepClock", () => {
  it("caps frame delta and discards time beyond four fixed steps", () => {
    const clock = new FixedStepClock(1 / 60, 4, 0.1);
    const step = vi.fn();

    clock.advance(0, step);
    expect(clock.advance(1_000, step)).toBe(0);
    expect(step).toHaveBeenCalledTimes(4);
  });

  it("returns interpolation for the remaining accumulated fraction", () => {
    const clock = new FixedStepClock(1 / 60, 4, 0.1);
    const step = vi.fn();

    clock.advance(0, step);
    expect(clock.advance(25, step)).toBeCloseTo(0.5);
    expect(step).toHaveBeenCalledTimes(1);
  });

  it("does not step while paused and resumes without catch-up", () => {
    const clock = new FixedStepClock(1 / 60, 4, 0.1);
    const step = vi.fn();

    clock.advance(0, step);
    clock.pause();
    expect(clock.advance(1_000, step)).toBe(0);
    clock.resume(1_000);
    expect(clock.advance(1_010, step)).toBeCloseTo(0.6);
    expect(step).not.toHaveBeenCalled();
  });

  it("resets accumulated time and its frame-time origin", () => {
    const clock = new FixedStepClock(1 / 60, 4, 0.1);
    const step = vi.fn();

    clock.advance(0, step);
    clock.advance(25, step);
    clock.reset(1_000);
    expect(clock.advance(1_000, step)).toBe(0);
    expect(step).toHaveBeenCalledTimes(1);
  });
});
