import { describe, expect, it, vi } from "vitest";
import { QUALITY_PROFILES } from "../quality/qualityProfiles";
import { NebulaPass } from "./NebulaPass";

describe("NebulaPass", () => {
  it.each([
    ["ultra", 96, 0.5], ["high", 72, 0.5], ["medium", 48, 0.5], ["low", 28, 0.35],
  ] as const)("maps %s quality to raymarch steps and target scale", (tier, steps, scale) => {
    const pass = new NebulaPass(QUALITY_PROFILES[tier]);
    pass.setSize(1000, 600);

    expect(pass.material.uniforms.uMaxSteps!.value).toBe(steps);
    expect(pass.renderTarget.width).toBe(Math.floor(1000 * scale));
    expect(pass.renderTarget.height).toBe(Math.floor(600 * scale));
    pass.dispose();
  });

  it("reallocates at the new quality scale and disposes owned GPU resources once", () => {
    const pass = new NebulaPass(QUALITY_PROFILES.high);
    pass.setSize(1000, 600);
    const densityDispose = vi.spyOn(pass.densityTexture, "dispose");
    const materialDispose = vi.spyOn(pass.material, "dispose");
    const quadDispose = vi.spyOn(pass.quad, "dispose");
    const targetDispose = vi.spyOn(pass.renderTarget, "dispose");

    pass.setQuality(QUALITY_PROFILES.low);
    expect(pass.renderTarget.width).toBe(350);
    expect(pass.renderTarget.height).toBe(210);

    pass.dispose();
    pass.dispose();

    expect(densityDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(quadDispose).toHaveBeenCalledTimes(1);
    expect(targetDispose).toHaveBeenCalledTimes(1);
  });
});
