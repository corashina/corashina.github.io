import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

describe("particle-only showcase shell", () => {
  it("exposes particle interactions and Reset View without a quality selector", () => {
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("select")).toBeNull();
    expect(document.querySelectorAll("button")).toHaveLength(1);
    expect(document.querySelector(".interaction-hint")?.textContent).toContain("Click or tap to pulse");
  });
});
