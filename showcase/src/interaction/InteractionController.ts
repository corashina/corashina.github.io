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
const PULSE_DURATION_SECONDS = 3;
const RELEASE_HOLD_SECONDS = 0.1;
const PULSE_START_RADIUS = 0.75;
const PULSE_TRAVEL = 8;
const POINTER_DAMPING_RATE = 8;
const POINTER_GRAVITY_DECAY_RATE = 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest("input, textarea, select, button, [contenteditable]:not([contenteditable='false'])") !== null;
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
  private readonly touchPointers = new Map<number, Vec2>();
  private readonly touchPulseSuppressed = new Set<number>();
  private pinchDistance: number | null = null;
  private pinching = false;
  private dragged = false;
  private orbitIntent: Vec2 = [0, 0];
  private zoomIntent = 0;
  private pulseId = 0;
  private pulseCharge = 0;
  private pulsePeak = 0;
  private pulseAge = PULSE_DURATION_SECONDS;
  private releasePulse = false;
  private resetPending = false;
  private disposed = false;
  private readonly handledPointerMoves = new WeakSet<object>();
  private readonly previousTouchAction: string;

  constructor(options: InteractionControllerOptions) {
    this.canvas = options.canvas;
    this.eventTarget = options.eventTarget;
    this.reducedMotion = options.reducedMotion;
    this.previousTouchAction = this.canvas.style.touchAction;
    this.canvas.style.touchAction = "none";
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
    const pulseAge = this.pulseAge;
    const pulseProgress = clamp(pulseAge / PULSE_DURATION_SECONDS, 0, 1);
    const pulseEnvelope = (1 - pulseProgress) ** 2;
    const pulseEnergy = this.pulsePeak * pulseEnvelope;
    const pulseRadius = pulseEnergy > 0 ? PULSE_START_RADIUS + pulseProgress * PULSE_TRAVEL : 0;
    const release = this.releasePulse && pulseAge <= RELEASE_HOLD_SECONDS + 1e-9;
    const resetRequested = this.resetPending;
    this.resetPending = false;

    const snapshot = Object.freeze({
      pointerNdc: Object.freeze([...this.pointerNdc]) as Vec2,
      pointerWorld: Object.freeze([0, 0, 0]) as readonly [number, number, number],
      pointerVelocity: Object.freeze([...this.pointerVelocity]) as Vec2,
      gravity: this.pointerGravity,
      orbitDelta: Object.freeze([...orbitDelta]) as Vec2,
      zoomDelta,
      pulseId: this.pulseId,
      pulseCharge: this.pulseCharge,
      pulseEnergy,
      pulseAge,
      pulseRadius,
      release,
      resetRequested,
      reducedMotion: this.reducedMotion,
    });
    this.pulseAge = Math.min(PULSE_DURATION_SECONDS, this.pulseAge + Math.max(0, deltaSeconds));
    this.pointerGravity *= Math.exp(-Math.max(0, deltaSeconds) * POINTER_GRAVITY_DECAY_RATE);
    if (this.pulseAge >= PULSE_DURATION_SECONDS) {
      this.pulsePeak = 0;
      this.releasePulse = false;
    }
    return snapshot;
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
    this.canvas.style.touchAction = this.previousTouchAction;
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.disposed) return;
    const point: Vec2 = [event.clientX, event.clientY];
    if (event.pointerType === "touch") {
      this.touchPointers.set(event.pointerId, point);
      this.touchPulseSuppressed.delete(event.pointerId);
    }
    this.activePointerId = event.pointerId;
    this.pointerStart = point;
    this.previousClientPointer = point;
    this.dragged = false;
    this.updatePointer(event);
    if (this.touchPointers.size >= 2) this.startPinch();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (this.disposed) return;
    if (this.handledPointerMoves.has(event)) return;
    this.handledPointerMoves.add(event);
    if (event.pointerType === "touch" && this.touchPointers.has(event.pointerId)) {
      this.touchPointers.set(event.pointerId, [event.clientX, event.clientY]);
      if (this.touchPointers.size >= 2) {
        this.updatePointer(event);
        this.updatePinch();
        return;
      }
    }
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
    if (this.disposed) return;
    if (event.pointerType === "touch" && this.touchPointers.has(event.pointerId)) {
      const wasPinching = this.pinching;
      const suppressPulse = this.touchPulseSuppressed.delete(event.pointerId);
      this.touchPointers.delete(event.pointerId);
      if (wasPinching) {
        this.rebaseTouchGesture();
        return;
      }
      if (event.pointerId !== this.activePointerId) return;
      this.updatePointer(event);
      if (!this.dragged && this.pointerStart !== null && !suppressPulse) this.triggerPulse();
      this.clearPointerGesture();
      return;
    }
    if (event.pointerId !== this.activePointerId) return;
    this.updatePointer(event);
    if (!this.dragged && this.pointerStart !== null) this.triggerPulse();
    this.clearPointerGesture();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (event.pointerType === "touch" && this.touchPointers.delete(event.pointerId)) {
      this.touchPulseSuppressed.delete(event.pointerId);
      this.rebaseTouchGesture();
      return;
    }
    if (event.pointerId === this.activePointerId) this.clearPointerGesture();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.disposed) return;
    event.preventDefault();
    this.zoomIntent = clamp(this.zoomIntent + event.deltaY / 1000, -1, 1);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed) return;
    if (isEditableTarget(event.target)) return;
    switch (event.code) {
      case "ArrowLeft": event.preventDefault(); this.orbitIntent = [this.orbitIntent[0] - CAMERA_KEYBOARD_STEP, this.orbitIntent[1]]; break;
      case "ArrowRight": event.preventDefault(); this.orbitIntent = [this.orbitIntent[0] + CAMERA_KEYBOARD_STEP, this.orbitIntent[1]]; break;
      case "ArrowUp": event.preventDefault(); this.orbitIntent = [this.orbitIntent[0], this.orbitIntent[1] - CAMERA_KEYBOARD_STEP]; break;
      case "ArrowDown": event.preventDefault(); this.orbitIntent = [this.orbitIntent[0], this.orbitIntent[1] + CAMERA_KEYBOARD_STEP]; break;
      case "Equal":
      case "NumpadAdd": event.preventDefault(); this.zoomIntent = clamp(this.zoomIntent - 0.25, -1, 1); break;
      case "Minus":
      case "NumpadSubtract": event.preventDefault(); this.zoomIntent = clamp(this.zoomIntent + 0.25, -1, 1); break;
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
    const pulse = accumulateEnergy(this.pulseCharge, PULSE_ENERGY_STEP);
    this.pulseId += 1;
    this.pulseAge = 0;
    this.pulsePeak = pulse.energy;
    if (pulse.release) {
      this.pulseCharge = 0;
      this.pulsePeak = 1;
      this.releasePulse = true;
      return;
    }
    this.pulseCharge = pulse.energy;
    this.releasePulse = false;
  }

  private clearPointerGesture(): void {
    this.activePointerId = null;
    this.pointerStart = null;
    this.previousClientPointer = null;
    this.dragged = false;
    this.pointerGravity = 1;
  }

  private startPinch(): void {
    this.pinching = true;
    this.dragged = true;
    this.pinchDistance = this.getTouchDistance();
    this.pointerGravity = 0;
    for (const pointerId of this.touchPointers.keys()) this.touchPulseSuppressed.add(pointerId);
  }

  private updatePinch(): void {
    const distance = this.getTouchDistance();
    if (distance === null || this.pinchDistance === null) return;
    this.zoomIntent = clamp(this.zoomIntent + (this.pinchDistance - distance) / 100, -1, 1);
    this.pinchDistance = distance;
    this.pointerGravity = 0;
  }

  private rebaseTouchGesture(): void {
    if (this.touchPointers.size >= 2) {
      this.startPinch();
      return;
    }
    this.pinching = false;
    this.pinchDistance = null;
    const remaining = this.touchPointers.entries().next().value as [number, Vec2] | undefined;
    if (remaining === undefined) {
      this.clearPointerGesture();
      return;
    }
    this.activePointerId = remaining[0];
    this.pointerStart = remaining[1];
    this.previousClientPointer = remaining[1];
    this.dragged = false;
    this.pointerGravity = 1;
  }

  private getTouchDistance(): number | null {
    const points = [...this.touchPointers.values()];
    const first = points[0];
    const second = points[1];
    if (first === undefined || second === undefined) return null;
    return Math.hypot(first[0] - second[0], first[1] - second[1]);
  }
}
