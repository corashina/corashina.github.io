const motionChunk = `
uniform float uTime;
uniform vec3 uPointer;
uniform float uPointerSpeed;
uniform vec4 uContentMask;

vec3 displacedPosition(vec3 base, vec4 seed) {
  float t = uTime * 0.22;
  float clusterPhase = seed.w * 6.28318530718;
  float clusterWave = sin(t + clusterPhase + seed.x * 18.0 + base.x * 0.0018);
  float crossWave = cos(t * 0.73 + clusterPhase + seed.y * 15.0 + base.y * 0.0024);
  vec3 drift = vec3(crossWave * 72.0, clusterWave * 58.0, sin(t + seed.x * 9.0) * 46.0);
  vec2 delta = base.xy + drift.xy - uPointer.xy;
  float pointerFalloff = exp(-dot(delta, delta) / 145000.0);
  vec2 tangent = normalize(vec2(-delta.y, delta.x) + vec2(0.0001));
  float pointerActivity = smoothstep(0.0, 0.08, uPointerSpeed);
  drift.xy += tangent * pointerFalloff * (18.0 + uPointerSpeed * 96.0) * pointerActivity;
  return base + drift;
}

float contentVisibility(vec2 screenPosition) {
  vec2 distanceFromCenter = abs(screenPosition - uContentMask.xy);
  vec2 edge = smoothstep(uContentMask.zw, uContentMask.zw + vec2(0.18), distanceFromCenter);
  return mix(0.28, 1.0, max(edge.x, edge.y));
}
`;

export const ambientVertexShader = `
attribute vec4 aSeed;
attribute float aLevel;
uniform float uQualityMix;
varying float vAlpha;
${motionChunk}
void main() {
  vec3 moved = displacedPosition(position, aSeed);
  vec4 view = modelViewMatrix * vec4(moved, 1.0);
  vec4 clip = projectionMatrix * view;
  vec2 screen = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  float tierAlpha = 1.0 - smoothstep(uQualityMix + 0.02, uQualityMix + 0.32, aLevel);
  vAlpha = contentVisibility(screen) * tierAlpha * mix(0.35, 1.0, aSeed.y);
  gl_PointSize = (1.25 + aSeed.z * 2.1) * clamp(900.0 / -view.z, 0.65, 2.4);
  gl_Position = clip;
}`;

export const ambientFragmentShader = `
uniform vec3 uParticleColor;
varying float vAlpha;
void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float radius = length(centered);
  float core = 1.0 - smoothstep(0.06, 0.5, radius);
  float halo = 1.0 - smoothstep(0.22, 0.5, radius);
  gl_FragColor = vec4(uParticleColor, (core + halo * 0.28) * vAlpha);
}`;

export const signalVertexShader = `
attribute vec3 aAnchor;
attribute vec4 aSignalSeed;
attribute float aLevel;
uniform float uQualityMix;
varying vec2 vUv;
varying float vEnergy;
varying float vTrail;
${motionChunk}
void main() {
  float pulse = 0.5 + 0.5 * sin(uTime * 1.35 + aSignalSeed.x * 22.0);
  float tierAlpha = 1.0 - smoothstep(uQualityMix + 0.02, uQualityMix + 0.32, aLevel);
  vec3 center = displacedPosition(aAnchor, aSignalSeed);
  vec4 viewCenter = modelViewMatrix * vec4(center, 1.0);
  float scale = 8.0 + pulse * 7.0 + uPointerSpeed * 5.0;
  float direction = aSignalSeed.y * 6.28318530718 + sin(uTime * 0.4 + aSignalSeed.w * 8.0);
  mat2 rotation = mat2(cos(direction), -sin(direction), sin(direction), cos(direction));
  vec2 quad = rotation * (position.xy * vec2(scale * (1.0 + uPointerSpeed * 1.8), scale));
  vec4 clip = projectionMatrix * (viewCenter + vec4(quad, 0.0, 0.0));
  vec2 screen = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  vUv = uv;
  vEnergy = pulse * tierAlpha * contentVisibility(screen);
  vTrail = 0.12 + uPointerSpeed * 0.88;
  gl_Position = clip;
}`;

export const signalFragmentShader = `
uniform vec3 uSignalColor;
varying vec2 vUv;
varying float vEnergy;
varying float vTrail;
void main() {
  vec2 centered = vUv - 0.5;
  float radial = 1.0 - smoothstep(0.02, 0.5, length(centered));
  float trail = exp(-abs(centered.y) * 18.0) * (1.0 - smoothstep(0.0, 0.52, vUv.x)) * vTrail;
  gl_FragColor = vec4(uSignalColor, (radial * (0.28 + vEnergy * 0.72) + trail * 0.3) * vEnergy);
}`;

export const connectionVertexShader = `
attribute vec3 aEndpoint;
attribute vec4 aEndpointSeed;
attribute float aEdgePhase;
attribute float aLevel;
uniform float uQualityMix;
varying float vSignal;
varying float vVisibility;
${motionChunk}
void main() {
  vec3 moved = displacedPosition(aEndpoint, aEndpointSeed);
  float pulse = 0.5 + 0.5 * sin(uTime * 1.1 - aEdgePhase * 20.0);
  float tierAlpha = 1.0 - smoothstep(uQualityMix + 0.02, uQualityMix + 0.32, aLevel);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
  vec2 screen = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  vSignal = pulse;
  vVisibility = tierAlpha * contentVisibility(screen);
  gl_Position = clip;
}`;

export const connectionFragmentShader = `
uniform vec3 uConnectionColor;
varying float vSignal;
varying float vVisibility;
void main() {
  gl_FragColor = vec4(uConnectionColor, (0.025 + vSignal * 0.16) * vVisibility);
}`;
