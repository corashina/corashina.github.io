import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SCENE_PARAMETERS } from "../runtime/SceneParameters";
import { ParameterPanel } from "./ParameterPanel";

function panelRoot(): HTMLElement {
  document.body.innerHTML = `<aside class="particle-lab"><button data-panel-toggle></button><div data-panel-body></div><button data-parameter-reset></button></aside>`;
  return document.querySelector<HTMLElement>(".particle-lab")!;
}

describe("ParameterPanel", () => {
  it("builds seven labeled sliders and publishes normalized input", () => {
    const onChange = vi.fn();
    const panel = new ParameterPanel({
      root: panelRoot(),
      initial: { ...DEFAULT_SCENE_PARAMETERS },
      collapsed: false,
      onChange,
    });
    const speed = document.querySelector<HTMLInputElement>('[data-parameter="speed"]')!;

    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(7);
    expect(speed.closest("label")?.textContent).toContain("Speed");

    speed.value = "4.5";
    speed.dispatchEvent(new Event("input", { bubbles: true }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4.5 }));
    panel.dispose();
  });

  it("resets values, reflects collapse state, and removes listeners", () => {
    const root = panelRoot();
    const onChange = vi.fn();
    const panel = new ParameterPanel({
      root,
      initial: { ...DEFAULT_SCENE_PARAMETERS, speed: 1 },
      collapsed: true,
      onChange,
    });
    const toggle = root.querySelector<HTMLButtonElement>("[data-panel-toggle]")!;

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    root.querySelector<HTMLButtonElement>("[data-parameter-reset]")!.click();
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_SCENE_PARAMETERS);

    panel.dispose();
    onChange.mockClear();
    toggle.click();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(onChange).not.toHaveBeenCalled();
  });
});
