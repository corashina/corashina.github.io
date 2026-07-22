import { describe, expect, it, vi } from "vitest";
import { FpsCounter } from "./FpsCounter";

describe("FpsCounter", () => {
  it("publishes a stable rolling rate no more than four times per second", () => {
    const publish = vi.fn();
    const counter = new FpsCounter(publish);
    for (let now = 0; now <= 1000; now += 1000 / 60) counter.sample(now);
    expect(publish.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(publish.mock.calls.length).toBeLessThanOrEqual(5);
    expect(publish.mock.lastCall?.[0]).toBeGreaterThanOrEqual(59);
    expect(publish.mock.lastCall?.[0]).toBeLessThanOrEqual(61);
  });

  it("resets its sample window and stops publishing after disposal", () => {
    const publish = vi.fn();
    const counter = new FpsCounter(publish);
    counter.sample(0);
    counter.sample(300);
    counter.reset();
    counter.sample(500);
    counter.sample(600);
    expect(publish).toHaveBeenLastCalledWith(10);

    publish.mockClear();
    counter.dispose();
    counter.sample(900);
    expect(publish).not.toHaveBeenCalled();
  });
});
