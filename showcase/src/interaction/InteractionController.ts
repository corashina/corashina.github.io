import type { InteractionSnapshot, Vec2 } from "../app/contracts";
import { accumulateEnergy, classifyGesture, normalizePointer } from "./interactionMath";

type EventSource = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export type InteractionControllerOptions = {
  canvas: HTMLCanvasElement;
  eventTarget: EventSource;
  reducedMotion: boolean;
};

const CAMERA_KEYBOARD_STEP = 0.12;
const PULSE_ENERGY_STEP = 0.25;
const POINTER_DAMPING_RATE = 8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export class InteractionController {
  private readonly canvas: HTMLCanvasElement;
  private readonly eventTarget: EventSource;
  private readonly reducedMotion: boolean;
  private pointerNdc: Vec2 = [0, 0];
  private pointerVelocity: Vec2 = [0, 0];
  private pointerGravity = 0;
  private previousPointerNdc: Vec2 | null = null;
  private activePointerId: number | null = null;
  private pointerStart: Vec2 | null = null;
  private previousClientPointer: Vec2 | null = null;
  private dragged = false;
  private orbitIntent: Vec2 = [0, 0];
  private zoomIntent = 0;
  private pulseId = 0;
  private pulseEnergy = 0;
  private releasePending = false;
  private resetPending = false;
  private disposed = false;
  private readonly handledPointerMoves = new WeakSet<object>();

  constructor(options: InteractionControllerOptions) {
    this.canvas = options.canvas;
    this.eventTarget = options.eventTarget;
    this.reducedMotion = options.reducedMotion;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.eventTarget.addEventListener("pointermove", this.onPointerMove as EventListener);
    this.eventTarget.addEventListener("pointerup", this.onPointerUp as EventListener);
    this.eventTarget.addEventListener("pointercancel", this.onPointerCancel as EventListener);
    this.eventTarget.addEventListener("keydown", this.onKeyDown as EventListener);
  }

  sample(deltaSeconds: number): InteractionSnapshot {
    const pointerDamping = Math.exp(-deltaSeconds * POINTER_DAMPING_RATE);
    this.pointerVelocity = [
      this.pointerVelocity[0] * pointerDamping,
      this.pointerVelocity[1] * pointerDamping,
    ];

    const orbitDelta: Vec2 = [...this.orbitIntent];
    this.orbitIntent = [0, 0];
    const zoomDelta = this.zoomIntent;
    this.zoomIntent = 0;
    const release = this.releasePending;
    this.releasePending = false;
    const resetRequested = this.resetPending;
    this.resetPending = false;

    return Object.freeze({
      pointerNdc: Object.freeze([...this.pointerNdc]) as Vec2,
      pointerWorld: Object.freeze([0, 0, 0]) as readonly [number, number, number],
      pointerVelocity: Object.freeze([...this.pointerVelocity]) as Vec2,
      gravity: this.pointerGravity,
      orbitDelta: Object.freeze([...orbitDelta]) as Vec2,
      zoomDelta,
      pulseId: this.pulseId,
      pulseEnergy: this.pulseEnergy,
      release,
      resetRequested,
      reducedMotion: this.reducedMotion,
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.eventTarget.removeEventListener("pointermove", this.onPointerMove as EventListener);
    this.eventTarget.removeEventListener("pointerup", this.onPointerUp as EventListener);
    this.eventTarget.removeEventListener("pointercancel", this.onPointerCancel as EventListener);
    this.eventTarget.removeEventListener("keydown", this.onKeyDown as EventListener);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    const point: Vec2 = [event.clientX, event.clientY];
    this.activePointerId = event.pointerId;
    this.pointerStart = point;
    this.previousClientPointer = point;
    this.dragged = false;
    this.updatePointer(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.disposed) return;
    if (this.handledPointerMoves.has(event)) return;
    this.handledPointerMoves.add(event);
    this.updatePointer(event);
    if (this.activePointerId !== event.pointerId || this.pointerStart === null) return;

    const point: Vec2 = [event.clientX, event.clientY];
    if (!this.dragged && classifyGesture(this.pointerStart, point) === "drag") this.dragged = true;
    if (this.dragged && this.previousClientPointer !== null) {
      this.orbitIntent = [
        this.orbitIntent[0] + (point[0] - this.previousClientPointer[0]) * 0.006,
        this.orbitIntent[1] + (point[1] - this.previousClientPointer[1]) * 0.006,
      ];
      this.pointerGravity = 0;
    }
    this.previousClientPointer = point;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.disposed || event.pointerId !== this.activePointerId) return;
    this.updatePointer(event);
    if (!this.dragged && this.pointerStart !== null) this.triggerPulse();
    this.clearPointerGesture();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.activePointerId) this.clearPointerGesture();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.disposed) return;
    event.preventDefault();
    this.zoomIntent = clamp(this.zoomIntent + event.deltaY / 1000, -1, 1);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed) return;
    switch (event.code) {
      case "ArrowLeft": this.orbitIntent = [this.orbitIntent[0] - CAMERA_KEYBOARD_STEP, this.orbitIntent[1]]; break;
      case "ArrowRight": this.orbitIntent = [this.orbitIntent[0] + CAMERA_KEYBOARD_STEP, this.orbitIntent[1]]; break;
      case "ArrowUp": this.orbitIntent = [this.orbitIntent[0], this.orbitIntent[1] - CAMERA_KEYBOARD_STEP]; break;
      case "ArrowDown": this.orbitIntent = [this.orbitIntent[0], this.orbitIntent[1] + CAMERA_KEYBOARD_STEP]; break;
      case "Equal":
      case "NumpadAdd": this.zoomIntent = clamp(this.zoomIntent - 0.25, -1, 1); break;
      case "Minus":
      case "NumpadSubtract": this.zoomIntent = clamp(this.zoomIntent + 0.25, -1, 1); break;
      case "Space": event.preventDefault(); this.triggerPulse(); break;
      case "KeyR": this.resetPending = true; break;
      default: return;
    }
  };

  private updatePointer(event: PointerEvent): void {
    const bounds = this.canvas.getBoundingClientRect();
    const nextPointer = normalizePointer(event.clientX, event.clientY, bounds);
    if (this.previousPointerNdc !== null) {
      this.pointerVelocity = [
        nextPointer[0] - this.previousPointerNdc[0],
        nextPointer[1] - this.previousPointerNdc[1],
      ];
    }
    this.pointerNdc = nextPointer;
    this.previousPointerNdc = nextPointer;
    this.pointerGravity = this.dragged ? 0 : 1;
  }

  private triggerPulse(): void {
    const pulse = accumulateEnergy(this.pulseEnergy, PULSE_ENERGY_STEP);
    this.pulseId += 1;
    this.pulseEnergy = pulse.energy;
    this.releasePending ||= pulse.release;
  }

  private clearPointerGesture(): void {
    this.activePointerId = null;
    this.pointerStart = null;
    this.previousClientPointer = null;
    this.dragged = false;
  }
}
