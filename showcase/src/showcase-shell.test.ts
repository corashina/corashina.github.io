import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

describe("particle-only showcase shell", () => {
  it("exposes particle interactions and Particle Lab without a quality selector", () => {
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelector("[data-quality-selector]")).toBeNull();
    expect(document.querySelectorAll("button")).toHaveLength(3);
    expect(document.querySelector(".interaction-hint")?.textContent).toContain("Click or tap to pulse");
    expect(document.querySelector("aside.particle-lab")?.getAttribute("aria-label")).toBe("Particle Lab controls");
    expect(document.querySelector("[data-panel-toggle]")?.getAttribute("aria-label")).toBe("Toggle Particle Lab");
    expect(document.querySelector("[data-fps]")?.textContent).toBe("-- FPS");
  });
});
