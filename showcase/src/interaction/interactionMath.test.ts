import { describe, expect, it } from "vitest";
import { accumulateEnergy, classifyGesture, normalizePointer } from "./interactionMath";

describe("interaction math", () => {
  it("normalizes pointer coordinates into clip space", () => {
    expect(normalizePointer(750, 125, { left: 250, top: 25, width: 1000, height: 500 })).toEqual([0, 0.6]);
  });

  it("separates a click from a drag at six CSS pixels", () => {
    expect(classifyGesture([10, 10], [15, 12])).toBe("pulse");
    expect(classifyGesture([10, 10], [17, 10])).toBe("drag");
  });

  it("caps energy and requests a release at the ceiling", () => {
    expect(accumulateEnergy(0.8, 0.3)).toEqual({ energy: 1, release: true });
    expect(accumulateEnergy(0.2, 0.3)).toEqual({ energy: 0.5, release: false });
  });
});
