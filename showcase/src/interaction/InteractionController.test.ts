import { describe, expect, it } from "vitest";
import { InteractionController } from "./InteractionController";

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "getBoundingClientRect", {
    value: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  });
  return canvas;
}

function pointerEvent(type: string, x: number, y: number, pointerType = "mouse", pointerId = 1): PointerEvent {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
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

  it("retains velocity after a single touch pointer moves", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 30, 50, "touch", 1));
    canvas.dispatchEvent(pointerEvent("pointermove", 60, 50, "touch", 1));

    expect(controller.sample(1 / 60).pointerVelocity[0]).not.toBe(0);
  });

  it("accumulates charge independently while restarting a transient pulse envelope", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 50, 50));
    window.dispatchEvent(pointerEvent("pointerup", 50, 50));
    expect(controller.sample(1 / 60)).toMatchObject({ pulseId: 1, pulseCharge: 0.25, pulseEnergy: 0.25, pulseAge: 0, pulseRadius: 0.75, release: false });

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(controller.sample(1 / 60)).toMatchObject({ pulseId: 2, pulseCharge: 0.5, pulseEnergy: 0.5, pulseAge: 0, pulseRadius: 0.75, release: false });
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

  it("turns a two-touch distance change into zoom without orbiting", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 30, 50, "touch", 1));
    canvas.dispatchEvent(pointerEvent("pointerdown", 70, 50, "touch", 2));
    canvas.dispatchEvent(pointerEvent("pointermove", 90, 50, "touch", 2));

    const interaction = controller.sample(1 / 60);
    expect(interaction.zoomDelta).toBeLessThan(0);
    expect(interaction.orbitDelta).toEqual([0, 0]);
  });

  it("restores pointer gravity when a drag ends", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    canvas.dispatchEvent(pointerEvent("pointerdown", 10, 10));
    window.dispatchEvent(pointerEvent("pointermove", 30, 10));
    expect(controller.sample(1 / 60).gravity).toBe(0);
    window.dispatchEvent(pointerEvent("pointerup", 30, 10));

    expect(controller.sample(1 / 60).gravity).toBe(1);
  });

  it("lets pointer gravity decay after movement stops", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });
    canvas.dispatchEvent(pointerEvent("pointermove", 70, 50));
    expect(controller.sample(1 / 60).gravity).toBe(1);
    for (let index = 0; index < 120; index += 1) controller.sample(1 / 60);
    expect(controller.sample(1 / 60).gravity).toBeLessThan(0.03);
  });

  it("leaves keyboard shortcuts and default browser behavior alone inside controls", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });
    const input = document.createElement("input");
    document.body.append(input);
    const space = new KeyboardEvent("keydown", { code: "Space", bubbles: true, cancelable: true });
    const arrow = new KeyboardEvent("keydown", { code: "ArrowRight", bubbles: true, cancelable: true });
    input.dispatchEvent(space); input.dispatchEvent(arrow);
    expect(space.defaultPrevented).toBe(false);
    expect(arrow.defaultPrevented).toBe(false);
    expect(controller.sample(1 / 60)).toMatchObject({ pulseId: 0, orbitDelta: [0, 0] });
    input.remove(); controller.dispose();
  });

  it("disables browser touch gestures on the canvas while active", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });
    expect(canvas.style.touchAction).toBe("none");
    controller.dispose();
    expect(canvas.style.touchAction).toBe("");
  });

  it("holds a peak release across slow-tier field cadences then decays over three seconds", () => {
    const canvas = createCanvas();
    const controller = new InteractionController({ canvas, eventTarget: window, reducedMotion: false });

    for (let index = 0; index < 4; index += 1) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    }
    const peak = controller.sample(1 / 60);
    expect(peak).toMatchObject({ pulseCharge: 0, pulseEnergy: 1, pulseAge: 0, release: true });
    for (let index = 0; index < 6; index += 1) {
      expect(controller.sample(1 / 60).release).toBe(true);
    }
    const returning = controller.sample(1 / 60);
    expect(returning.release).toBe(false);
    expect(returning.pulseEnergy).toBeGreaterThan(0);
    expect(returning.pulseEnergy).toBeLessThan(1);

    for (let index = 0; index < 180; index += 1) controller.sample(1 / 60);
    expect(controller.sample(1 / 60)).toMatchObject({ pulseEnergy: 0, pulseRadius: 0, release: false });

    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    expect(controller.sample(1 / 60)).toMatchObject({ pulseCharge: 0.25, pulseEnergy: 0.25, release: false });
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
