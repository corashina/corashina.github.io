export type PointerBounds = Pick<DOMRect, "height" | "left" | "top" | "width">;

const DRAG_THRESHOLD_PX = 6;

export function normalizePointer(clientX: number, clientY: number, bounds: PointerBounds): [number, number] {
  const x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
  const y = 1 - ((clientY - bounds.top) / bounds.height) * 2;
  return [x, y];
}

export function classifyGesture(start: readonly [number, number], end: readonly [number, number]): "drag" | "pulse" {
  return Math.hypot(end[0] - start[0], end[1] - start[1]) > DRAG_THRESHOLD_PX ? "drag" : "pulse";
}

export function accumulateEnergy(energy: number, increment: number): { energy: number; release: boolean } {
  const nextEnergy = Math.min(1, Math.max(0, energy + increment));
  return { energy: nextEnergy, release: nextEnergy === 1 };
}
