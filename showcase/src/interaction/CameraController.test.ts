import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { FrameContext, InteractionSnapshot } from "../app/contracts";
import { CameraController, type CameraBounds } from "./CameraController";

const bounds: CameraBounds = { radius: [5.5, 13], polarAngle: [0.45, 1.35] };

function interaction(overrides: Partial<InteractionSnapshot> = {}): InteractionSnapshot {
  return {
    pointerNdc: [0, 0],
    pointerWorld: [0, 0, 0],
    pointerVelocity: [0, 0],
    gravity: 0,
    orbitDelta: [0, 0],
    zoomDelta: 0,
    pulseId: 0,
    pulseCharge: 0,
    pulseEnergy: 0,
    pulseAge: 3,
    pulseRadius: 0,
    release: false,
    resetRequested: false,
    reducedMotion: false,
    ...overrides,
  };
}

function frame(overrides: Partial<InteractionSnapshot> = {}): FrameContext {
  return { deltaSeconds: 1 / 60, elapsedSeconds: 0, interaction: interaction(overrides) };
}

function camera(): PerspectiveCamera {
  return new PerspectiveCamera(45, 1, 0.1, 100);
}

describe("CameraController", () => {
  it("clamps radius and polar angle to the approved bounds", () => {
    const activeCamera = camera();
    const controller = new CameraController(activeCamera, bounds, false);

    controller.update(frame({ orbitDelta: [0, 100], zoomDelta: 100 }));
    expect(activeCamera.position.length()).toBeCloseTo(13);
    expect(Math.acos(activeCamera.position.y / activeCamera.position.length())).toBeCloseTo(1.35);

    controller.update(frame({ orbitDelta: [0, -100], zoomDelta: -100 }));
    expect(activeCamera.position.length()).toBeCloseTo(5.5);
    expect(Math.acos(activeCamera.position.y / activeCamera.position.length())).toBeCloseTo(0.45);
  });

  it("removes camera inertia under reduced motion", () => {
    const movingCamera = camera();
    const reducedCamera = camera();
    const moving = new CameraController(movingCamera, bounds, false);
    const reduced = new CameraController(reducedCamera, bounds, true);

    moving.update(frame({ orbitDelta: [0.2, 0] }));
    reduced.update(frame({ orbitDelta: [0.2, 0], reducedMotion: true }));
    const reducedAfterInput = reducedCamera.position.clone();
    moving.update(frame());
    reduced.update(frame({ reducedMotion: true }));

    expect(movingCamera.position.distanceTo(new Vector3(5.8, 3.2, 8.6))).toBeGreaterThan(
      reducedCamera.position.distanceTo(reducedAfterInput),
    );
    expect(reducedCamera.position).toEqual(reducedAfterInput);
  });

  it("restores the approved initial view after reset", () => {
    const activeCamera = camera();
    const controller = new CameraController(activeCamera, bounds, false);

    controller.update(frame({ orbitDelta: [1, 0.3], zoomDelta: 2 }));
    controller.update(frame({ resetRequested: true }));

    expect(activeCamera.position.toArray()).toEqual([5.8, 3.2, 8.6]);
  });

  it("projects NDC input onto the core plane through a Three.js Raycaster", () => {
    const activeCamera = camera();
    const controller = new CameraController(activeCamera, bounds, false);

    const point = controller.projectPointer([0.35, -0.2]);
    const normal = activeCamera.position.clone().normalize();
    expect(normal.dot(new Vector3(...point))).toBeCloseTo(0, 6);
  });
});
