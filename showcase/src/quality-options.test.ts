import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

describe("quality selector", () => {
  it("offers every quality level in display order", () => {
    const document = new DOMParser().parseFromString(html, "text/html");
    const options = Array.from(document.querySelectorAll("select option"), (option) => option.textContent);

    expect(options).toEqual(["Auto", "Ultra", "High", "Medium", "Low"]);
  });
});
