import * as THREE from "three";

export type MetaballSource = {
  x: number;
  y: number;
  z: number;
  radius: number;
  energy: number;
  color: THREE.Color;
};

export type MetaballEffect = {
  reset(): void;
  addBall(x: number, y: number, z: number, strength: number, subtract: number, color: THREE.Color): void;
  update(): void;
};

const SOURCE_COUNT = 6;
const RELEASE_DISPLACEMENT = 0.06;
const WARM_COLORS = ["#ffb36a", "#ff7a4f", "#ffd39a", "#ff9e62", "#ffe0ad", "#ff7655"] as const;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Samples the deterministic local-space orbit used to drive the marching surface. */
export function sampleMetaballs(elapsed: number, energy: number, release: boolean): MetaballSource[] {
  const boundedEnergy = clampUnit(energy);
  const sources: MetaballSource[] = [];

  for (let index = 0; index < SOURCE_COUNT; index += 1) {
    const phase = (index / SOURCE_COUNT) * Math.PI * 2;
    const orbit = 0.18 + boundedEnergy * 0.24 + (release ? RELEASE_DISPLACEMENT : 0);
    const xDirection = Math.sin(elapsed * 1.17 + phase);
    const yDirection = Math.sin(elapsed * 1.83 + phase * 1.7) * 0.78;
    const zDirection = Math.cos(elapsed * 1.41 + phase * 0.63) * 0.9;
    const directionLength = Math.hypot(xDirection, yDirection, zDirection);
    const radiusWave = (Math.sin(elapsed * 0.9 + phase * 2.3) + 1) * 0.5;

    sources.push({
      x: (xDirection / directionLength) * orbit,
      y: (yDirection / directionLength) * orbit,
      z: (zDirection / directionLength) * orbit,
      radius: 0.12 + radiusWave * 0.3,
      energy: boundedEnergy,
      color: new THREE.Color(WARM_COLORS[index]!),
    });
  }

  return sources;
}

/** Clears and repopulates a MarchingCubes scalar field from local-space samples. */
export function applyMetaballs(effect: MetaballEffect, sources: readonly MetaballSource[]): void {
  effect.reset();
  for (const source of sources) {
    effect.addBall(
      clampUnit(source.x * 0.5 + 0.5),
      clampUnit(source.y * 0.5 + 0.5),
      clampUnit(source.z * 0.5 + 0.5),
      0.72 + source.energy * 0.24,
      12,
      source.color,
    );
  }
  effect.update();
}
