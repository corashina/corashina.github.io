export type SceneParameterKey =
  | "speed" | "orbitStrength" | "turbulence" | "drag"
  | "particleSize" | "bloomStrength" | "pulseStrength";

export type SceneParameters = Record<SceneParameterKey, number>;

export type SceneParameterDefinition = {
  label: string;
  min: number;
  max: number;
  step: number;
};

export const DEFAULT_SCENE_PARAMETERS: Readonly<SceneParameters> = Object.freeze({
  speed: 3,
  orbitStrength: 0.75,
  turbulence: 0.35,
  drag: 0.03,
  particleSize: 16,
  bloomStrength: 0.65,
  pulseStrength: 1,
});

export const SCENE_PARAMETER_DEFINITIONS: Readonly<Record<SceneParameterKey, SceneParameterDefinition>> = Object.freeze({
  speed: { label: "Speed", min: 0.25, max: 5, step: 0.25 },
  orbitStrength: { label: "Orbit", min: 0, max: 2, step: 0.05 },
  turbulence: { label: "Turbulence", min: 0, max: 1.5, step: 0.05 },
  drag: { label: "Drag", min: 0, max: 0.5, step: 0.01 },
  particleSize: { label: "Particle size", min: 4, max: 28, step: 1 },
  bloomStrength: { label: "Bloom", min: 0, max: 1.5, step: 0.05 },
  pulseStrength: { label: "Pulse", min: 0, max: 2, step: 0.05 },
});

export function updateSceneParameter(current: SceneParameters, key: SceneParameterKey, value: number): SceneParameters {
  const definition = SCENE_PARAMETER_DEFINITIONS[key];
  const valid = Number.isFinite(value) ? value : current[key];
  return { ...current, [key]: Math.min(definition.max, Math.max(definition.min, valid)) };
}

export function normalizeSceneParameters(
  candidate: Partial<SceneParameters>,
  previous: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS },
): SceneParameters {
  return (Object.keys(SCENE_PARAMETER_DEFINITIONS) as SceneParameterKey[]).reduce(
    (next, key) => updateSceneParameter(next, key, candidate[key] ?? previous[key]),
    { ...previous },
  );
}
