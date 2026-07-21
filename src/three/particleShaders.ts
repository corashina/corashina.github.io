const motionChunk = `
uniform float uTime;
uniform vec3 uPointer;
uniform float uPointerSpeed;
uniform vec4 uContentMask;

const float TAU = 6.28318530718;

vec3 flowPotential(vec3 point, vec3 phase) {
  return 0.5 * vec3(
    sin(point.y + phase.x) + cos(point.z * 1.17 - phase.z),
    sin(point.z + phase.y) + cos(point.x * 1.13 + phase.x),
    sin(point.x + phase.z) + cos(point.y * 1.11 - phase.y)
  );
}

vec3 curlFlow(vec3 samplePosition, vec3 phase) {
  const float epsilon = 0.075;
  vec3 xOffset = vec3(epsilon, 0.0, 0.0);
  vec3 yOffset = vec3(0.0, epsilon, 0.0);
  vec3 zOffset = vec3(0.0, 0.0, epsilon);
  vec3 potentialXPlus = flowPotential(samplePosition + xOffset, phase);
  vec3 potentialXMinus = flowPotential(samplePosition - xOffset, phase);
  vec3 potentialYPlus = flowPotential(samplePosition + yOffset, phase);
  vec3 potentialYMinus = flowPotential(samplePosition - yOffset, phase);
  vec3 potentialZPlus = flowPotential(samplePosition + zOffset, phase);
  vec3 potentialZMinus = flowPotential(samplePosition - zOffset, phase);
  float inverseSpan = 0.5 / epsilon;
  float dAzDy = (potentialYPlus.z - potentialYMinus.z) * inverseSpan;
  float dAyDz = (potentialZPlus.y - potentialZMinus.y) * inverseSpan;
  float dAxDz = (potentialZPlus.x - potentialZMinus.x) * inverseSpan;
  float dAzDx = (potentialXPlus.z - potentialXMinus.z) * inverseSpan;
  float dAyDx = (potentialXPlus.y - potentialXMinus.y) * inverseSpan;
  float dAxDy = (potentialYPlus.x - potentialYMinus.x) * inverseSpan;
  return vec3(dAzDy - dAyDz, dAxDz - dAzDx, dAyDx - dAxDy);
}

float clusterLifetime(vec4 seed) {
  float clusterIdentity = floor(seed.w * 23.0 + 0.5) / 24.0;
  float clusterCycle = fract(uTime * 0.018 + clusterIdentity);
  float formation = smoothstep(0.0, 0.18, clusterCycle);
  float dissolution = 1.0 - smoothstep(0.68, 1.0, clusterCycle);
  return formation * dissolution;
}

vec3 displacedPosition(vec3 base, vec4 seed) {
  float clusterIndex = floor(seed.w * 23.0 + 0.5);
  float clusterPhase = clusterIndex / 24.0 * TAU;
  float clusterAngle = clusterIndex / 24.0 * TAU;
  float clusterRadius = 180.0 + mod(clusterIndex, 6.0) * 220.0;
  vec2 clusterCenter = vec2(
    cos(clusterAngle) * clusterRadius,
    sin(clusterAngle) * clusterRadius * 0.58
  );
  float migrationTime = uTime * 0.035;
  vec2 migratingCenter = clusterCenter + vec2(
    sin(migrationTime + clusterPhase * 1.7) * 115.0,
    cos(migrationTime * 0.83 + clusterPhase * 1.3) * 72.0
  );
  float clusterBreath = 0.82 + sin(uTime * 0.16 + clusterPhase) * 0.28;
  float lifetime = clusterLifetime(seed);
  vec3 clusteredPosition = base;
  clusteredPosition.xy = migratingCenter + (base.xy - clusterCenter) * clusterBreath;
  clusteredPosition.z = base.z * clusterBreath;

  vec3 flowPhase = vec3(clusterPhase, clusterPhase + 2.1, clusterPhase + 4.2);
  vec3 lowFlowPoint = base * 0.00115 + vec3(
    migrationTime * 0.31,
    -migrationTime * 0.23,
    migrationTime * 0.19
  );
  vec3 detailFlowPoint = base * 0.00345 + vec3(
    -migrationTime * 0.47,
    migrationTime * 0.37,
    migrationTime * 0.29
  );
  vec3 lowFrequencyCurl = curlFlow(lowFlowPoint, flowPhase);
  vec3 detailCurl = curlFlow(
    detailFlowPoint,
    flowPhase.yzx + vec3(seed.x, seed.y, seed.x + seed.y) * 0.35
  );
  vec3 drift = lowFrequencyCurl * 66.0 + detailCurl * 24.0;
  drift += (clusteredPosition - base) * lifetime;
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
  float lifetimeVisibility = clusterLifetime(aSeed);
  vAlpha = contentVisibility(screen) * tierAlpha * lifetimeVisibility * mix(0.35, 1.0, aSeed.y);
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
  float lifetimeVisibility = clusterLifetime(aSignalSeed);
  vEnergy = pulse * tierAlpha * contentVisibility(screen) * lifetimeVisibility;
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
attribute float aEndpointCoordinate;
attribute vec4 aEdgeMeta;
attribute float aLevel;
uniform float uQualityMix;
varying float vEndpointCoordinate;
varying float vEdgePhase;
varying float vVisibility;
${motionChunk}
void main() {
  vec3 moved = displacedPosition(aEndpoint, aEndpointSeed);
  float tierAlpha = 1.0 - smoothstep(uQualityMix + 0.02, uQualityMix + 0.32, aLevel);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
  vec2 screen = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  float distanceVisibility = 1.0 - smoothstep(0.28, 1.0, aEdgeMeta.x);
  float depthVisibility = mix(1.0, 0.35, aEdgeMeta.y);
  float clusterPhase = 0.5 + 0.5 * sin(uTime * 0.55 + aEdgeMeta.z * 6.28318530718);
  float signalActivity = mix(0.45, 1.0, aEdgeMeta.w) * mix(0.6, 1.0, clusterPhase);
  float lifetimeVisibility = clusterLifetime(aEndpointSeed);
  vEndpointCoordinate = aEndpointCoordinate;
  vEdgePhase = aEdgePhase;
  vVisibility = tierAlpha * contentVisibility(screen) * distanceVisibility * depthVisibility * signalActivity * lifetimeVisibility;
  gl_Position = clip;
}`;

export const connectionFragmentShader = `
uniform vec3 uConnectionColor;
uniform float uTime;
uniform float uPointerSpeed;
varying float vEndpointCoordinate;
varying float vEdgePhase;
varying float vVisibility;
void main() {
  float pulsePosition = fract(uTime * 0.22 + vEdgePhase);
  float pulseDistance = abs(vEndpointCoordinate - pulsePosition);
  pulseDistance = min(pulseDistance, 1.0 - pulseDistance);
  float pulse = 1.0 - smoothstep(0.0, 0.16, pulseDistance);
  float pointerEnergy = clamp(uPointerSpeed, 0.0, 1.0);
  float connectionEnergy = clamp(0.025 + pulse * (0.12 + pointerEnergy * 0.11), 0.025, 0.28);
  gl_FragColor = vec4(uConnectionColor, connectionEnergy * vVisibility);
}`;
