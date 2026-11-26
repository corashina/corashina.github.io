/** Point clouds for the Home hero. Every shape maps a particle index to a point roughly inside the unit sphere. */
export type Vec3 = readonly [number, number, number];
export type ShapeName = "sphere" | "torus" | "knot" | "cube" | "helix";
type Shape = (index: number, count: number) => Vec3;

const TAU = Math.PI * 2;
const GOLDEN_FRACTION = 0.618034;
const SILVER_FRACTION = 0.414214;
const fraction = (value: number): number => value - Math.floor(value);

const sphere: Shape = (index, count) => {
  const y = 1 - ((index + 0.5) / count) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * 2.39996;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
};

const torus: Shape = (index, count) => {
  const around = (index / count) * TAU * 37;
  const tube = fraction(index * GOLDEN_FRACTION) * TAU;
  const ring = 0.72 + 0.3 * Math.cos(tube);
  return [ring * Math.cos(around), 0.3 * Math.sin(tube), ring * Math.sin(around)];
};

const knot: Shape = (index, count) => {
  const t = (index / count) * TAU;
  const radius = 0.55 + 0.22 * Math.cos(3 * t);
  const jitterAngle = fraction(index * GOLDEN_FRACTION) * TAU;
  const thickness = 0.07;
  return [
    radius * Math.cos(2 * t) + thickness * Math.cos(jitterAngle),
    0.35 * Math.sin(3 * t) + thickness * Math.sin(jitterAngle),
    radius * Math.sin(2 * t) + thickness * Math.cos(jitterAngle + 1),
  ];
};

const cube: Shape = (index) => {
  const half = 0.62;
  const a = (fraction(index * GOLDEN_FRACTION) * 2 - 1) * half;
  const b = (fraction(index * SILVER_FRACTION) * 2 - 1) * half;
  const faces: Vec3[] = [
    [half, a, b],
    [-half, a, b],
    [a, half, b],
    [a, -half, b],
    [a, b, half],
    [a, b, -half],
  ];
  return faces[index % 6];
};

const helix: Shape = (index, count) => {
  const strand = index % 3;
  const turns = TAU * 2.2;
  if (strand === 2) {
    // Rungs between the two strands.
    const level = (Math.floor((index / count) * 28) / 28) * 2 - 1;
    const angle = level * turns;
    const along = fraction(index * GOLDEN_FRACTION) * 2 - 1;
    return [Math.cos(angle) * 0.45 * along, level * 1.05, Math.sin(angle) * 0.45 * along];
  }
  const t = (index / count) * 2 - 1;
  const angle = t * turns + (strand ? Math.PI : 0);
  return [Math.cos(angle) * 0.45, t * 1.05, Math.sin(angle) * 0.45];
};

export const SHAPES: Readonly<Record<ShapeName, Shape>> = { sphere, torus, knot, cube, helix };
export const MORPH_ORDER: readonly ShapeName[] = ["sphere", "torus", "knot", "cube", "helix"];

/** Seconds each shape is held, including its transition. */
export const MORPH_SEGMENT_SECONDS = 5.2;
/** Seconds the particles take to flow into the next shape. */
export const MORPH_TRANSITION_SECONDS = 1.6;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export type MorphState = { from: ShapeName; to: ShapeName; progress: number };

/** Which two shapes the cloud is between at a given time, and how far along (0–1, eased). */
export function morphStateAt(seconds: number): MorphState {
  const time = Math.max(0, seconds);
  const segment = Math.floor(time / MORPH_SEGMENT_SECONDS);
  const local = time - segment * MORPH_SEGMENT_SECONDS;
  return {
    from: MORPH_ORDER[segment % MORPH_ORDER.length],
    to: MORPH_ORDER[(segment + 1) % MORPH_ORDER.length],
    progress: easeInOutCubic(Math.min(1, local / MORPH_TRANSITION_SECONDS)),
  };
}
