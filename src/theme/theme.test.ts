import { describe, expect, it } from "vitest";
import { applyTheme } from "./theme";

describe("theme", () => {
  it("applies one class", () => {
    const root = document.createElement("body");
    root.className = "dark";
    applyTheme("white", root);
    expect(root).toHaveClass("white");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });
});
