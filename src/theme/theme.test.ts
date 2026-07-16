import { describe, expect, it } from "vitest";
import {
  applyTheme,
  getLocalStorage,
  persistTheme,
  readInitialTheme,
} from "./theme";

describe("theme", () => {
  it("prefers stored valid values", () => {
    expect(readInitialTheme({ getItem: () => "white" }, false)).toBe("white");
  });

  it("uses system preference without storage", () => {
    expect(readInitialTheme({ getItem: () => null }, true)).toBe("white");
    expect(readInitialTheme({ getItem: () => null }, false)).toBe("dark");
  });

  it("falls back when local storage access or reads raise a SecurityError", () => {
    const blockedWindow = {
      get localStorage(): Storage {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    };
    const blockedStorage = {
      getItem(): string | null {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    };

    expect(getLocalStorage(blockedWindow)).toBeUndefined();
    expect(readInitialTheme(blockedStorage, true)).toBe("white");
    expect(readInitialTheme(blockedStorage, false)).toBe("dark");
  });

  it("ignores SecurityError failures while persisting a theme", () => {
    const blockedStorage = {
      setItem(): void {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    };

    expect(() => persistTheme(blockedStorage, "white")).not.toThrow();
  });

  it("applies one class", () => {
    const root = document.createElement("body");
    root.className = "dark";
    applyTheme("white", root);
    expect(root).toHaveClass("white");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });
});
