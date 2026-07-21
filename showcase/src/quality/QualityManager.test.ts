import { describe, expect, it } from "vitest";
import { QualityManager } from "./QualityManager";

const warmUp = (manager: QualityManager, frameMs = 16, start = 0) => {
  for (let frame = 0; frame < 180; frame += 1) {
    expect(manager.sample(frameMs, start + frame)).toBeNull();
  }
};

const sampleFrames = (manager: QualityManager, count: number, frameMs: number, start = 0) => {
  let change: ReturnType<QualityManager["sample"]> = null;
  for (let frame = 0; frame < count; frame += 1) {
    change = manager.sample(frameMs, start + frame);
  }
  return change;
};

describe("QualityManager", () => {
  it("returns the profile for its selected tier", () => {
    const manager = new QualityManager("medium");

    expect(manager.getProfile()).toEqual({ particles: 192, membrane: 128, marchingCubes: 40, volumeSteps: 48, pixelRatio: 1.25, ssrScale: 0.25, gtao: "low", shadows: "pcf" });
  });

  it("ignores a 180-frame warm-up before collecting timing samples", () => {
    const manager = new QualityManager("high");

    warmUp(manager, 100);
    expect(manager.getTier()).toBe("high");
    expect(manager.sample(100, 180)).toBeNull();
  });

  it("downgrades when the rolling 120-frame 75th percentile exceeds 20 ms", () => {
    const manager = new QualityManager("high");

    warmUp(manager);
    expect(sampleFrames(manager, 120, 21, 180)).toBe("medium");
    expect(manager.getTier()).toBe("medium");
    expect(manager.getTransition(299.25)).toEqual({ from: "high", to: "medium", startedAt: 299, duration: 0.45 });
    expect(manager.getTransition(299.25)).not.toBeNull();
    expect(manager.getTransition(299.5)).toBeNull();
  });

  it("upgrades only once after 600 stable frames below 15 ms", () => {
    const manager = new QualityManager("medium");

    warmUp(manager);
    expect(sampleFrames(manager, 600, 14, 180)).toBe("high");
    expect(manager.getTier()).toBe("high");
    expect(sampleFrames(manager, 600, 14, 780)).toBeNull();
    expect(manager.getTier()).toBe("high");
  });

  it("enforces a 300-frame cooldown before another automatic downgrade", () => {
    const manager = new QualityManager("ultra");

    warmUp(manager);
    expect(sampleFrames(manager, 120, 21, 180)).toBe("high");
    expect(sampleFrames(manager, 300, 21, 300)).toBeNull();
    expect(sampleFrames(manager, 120, 21, 600)).toBe("medium");
  });

  it("locks automatic adaptation while a manual mode is selected", () => {
    const manager = new QualityManager("high");

    expect(manager.setMode("ultra")).toBe("ultra");
    warmUp(manager, 100);
    expect(sampleFrames(manager, 240, 100, 180)).toBeNull();
    expect(manager.getTier()).toBe("ultra");
    expect(manager.setMode("auto")).toBe("ultra");
  });

  it("does not oscillate back up during the downgrade cooldown", () => {
    const manager = new QualityManager("high");

    warmUp(manager);
    expect(sampleFrames(manager, 120, 21, 180)).toBe("medium");
    expect(sampleFrames(manager, 300, 14, 300)).toBeNull();
    expect(manager.getTier()).toBe("medium");
    expect(sampleFrames(manager, 600, 14, 600)).toBe("high");
  });
});
