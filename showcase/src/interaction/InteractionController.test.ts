import { describe, expect, it } from "vitest";
import { InteractionController } from "./InteractionController";

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  });
  return canvas;
}

function pointerEvent(type: string, x: number, y: number, pointerType = "mouse"): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: pointerType },
  });
  return event as PointerEvent;
}

describe("InteractionController", () => {
  it("normalizes touch-compatible pointer movement and damps its velocity", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointermove", 50, 50, "touch"));
    canvas.dispatchEvent(pointerEvent("pointermove", 70, 50, "touch"));

    const interaction = controller.sample(1 / 60);
    expect(interaction.pointerNdc[0]).toBeCloseTo(0.4);
    expect(interaction.pointerNdc[1]).toBe(0);
    expect(interaction.pointerVelocity[0]).toBeCloseTo(0.4 * Math.exp(-(1 / 60) * 8));
    expect(interaction.pointerVelocity[1]).toBe(0);
  });

  it("emits one pulse for a short click and Space", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 50, 50));
    window.dispatchEvent(pointerEvent("pointerup", 50, 50));
    expect(controller.sample(1 / 60)).toMatchObject({ pulseId: 1, pulseEnergy: 0.25, release: false });

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(controller.sample(1 / 60)).toMatchObject({ pulseId: 2, pulseEnergy: 0.5, release: false });
  });

  it("suppresses a pulse after a drag and consumes wheel, keyboard, and reset intent", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    window.dispatchEvent(pointerEvent("pointermove", 30, 10));
    window.dispatchEvent(pointerEvent("pointerup", 30, 10));
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 2000 }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" }));

    const interaction = controller.sample(1 / 60);
    expect(interaction.pulseId).toBe(0);
    expect(interaction.zoomDelta).toBe(1);
    expect(interaction.orbitDelta[0]).toBeGreaterThan(0);
    expect(interaction.resetRequested).toBe(true);
    expect(controller.sample(1 / 60).resetRequested).toBe(false);
  });

  it("removes listeners safely on repeated disposal", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    controller.dispose();
    expect(() => controller.dispose()).not.toThrow();
    canvas.dispatchEvent(pointerEvent("pointerdown", 50, 50));
    window.dispatchEvent(pointerEvent("pointerup", 50, 50));
    expect(controller.sample(1 / 60).pulseId).toBe(0);
  });
});
