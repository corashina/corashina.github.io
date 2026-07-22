import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENE_PARAMETERS,
  normalizeSceneParameters,
  SCENE_PARAMETER_DEFINITIONS,
  updateSceneParameter,
} from "./SceneParameters";

describe("SceneParameters", () => {
  it("defines the approved defaults and ranges", () => {
    expect(DEFAULT_SCENE_PARAMETERS).toEqual({
      speed: 3, orbitStrength: 0.75, turbulence: 0.35, drag: 0.03,
      particleSize: 16, bloomStrength: 0.65, pulseStrength: 1,
    });
    expect(SCENE_PARAMETER_DEFINITIONS.speed).toMatchObject({ min: 0.25, max: 5 });
    expect(SCENE_PARAMETER_DEFINITIONS.particleSize).toMatchObject({ min: 4, max: 28 });
  });

  it("clamps finite values and preserves the previous value for invalid input", () => {
    const next = normalizeSceneParameters({ ...DEFAULT_SCENE_PARAMETERS, speed: 99, drag: Number.NaN });
    expect(next.speed).toBe(5);
    expect(next.drag).toBe(0.03);
    expect(updateSceneParameter(next, "bloomStrength", -4).bloomStrength).toBe(0);
  });
});
