export const nebulaVertexShader = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

export const nebulaFragmentShader = /* glsl */ `
precision highp float;
precision highp sampler3D;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSceneDepth;
uniform sampler2D uSceneNormal;
uniform sampler3D uDensityVolume;
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorldMatrix;
uniform mat4 uCameraWorldMatrixInverse;
uniform vec3 uCameraPosition;
uniform vec3 uVolumeCenter;
uniform vec3 uVolumeHalfExtent;
uniform vec3 uPulsePosition;
uniform float uPulseRadius;
uniform float uTime;
uniform float uFrame;
uniform int uMaxSteps;
uniform float uHasDepth;
uniform float uHasNormal;

float blueNoise(vec2 pixel, float frame) {
  return fract(sin(dot(pixel + frame * 17.0, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec3 reconstructWorldPosition(vec2 uv, float depth) {
  vec4 clipPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPosition = uProjectionInverse * clipPosition;
  viewPosition /= max(viewPosition.w, 0.00001);
  return (uCameraWorldMatrix * viewPosition).xyz;
}

vec2 rayBoxIntersection(vec3 rayOrigin, vec3 rayDirection) {
  vec3 safeDirection = mix(vec3(-1.0), vec3(1.0), step(vec3(0.0), rayDirection)) * max(abs(rayDirection), vec3(0.0001));
  vec3 minimum = uVolumeCenter - uVolumeHalfExtent;
  vec3 maximum = uVolumeCenter + uVolumeHalfExtent;
  vec3 first = (minimum - rayOrigin) / safeDirection;
  vec3 second = (maximum - rayOrigin) / safeDirection;
  vec3 nearDistance = min(first, second);
  vec3 farDistance = max(first, second);
  return vec2(max(max(nearDistance.x, nearDistance.y), nearDistance.z), min(min(farDistance.x, farDistance.y), farDistance.z));
}

void main() {
  vec3 rayDirection = normalize(reconstructWorldPosition(vUv, 1.0) - uCameraPosition);
  vec3 viewRayDirection = normalize(mat3(uCameraWorldMatrixInverse) * rayDirection);
  vec2 hit = rayBoxIntersection(uCameraPosition, rayDirection);
  float rayStart = max(hit.x, 0.0);
  float rayEnd = hit.y;

  if (uHasDepth > 0.5) {
    float sceneDepth = texture(uSceneDepth, vUv).x;
    vec3 opaqueWorldPosition = reconstructWorldPosition(vUv, sceneDepth);
    float opaqueDistance = dot(opaqueWorldPosition - uCameraPosition, rayDirection);
    rayEnd = min(rayEnd, max(0.0, opaqueDistance));
  }

  if (rayEnd <= rayStart) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float normalSoftness = 1.0;
  if (uHasNormal > 0.5) {
    vec3 viewNormal = normalize(texture(uSceneNormal, vUv).xyz * 2.0 - 1.0);
    normalSoftness = smoothstep(0.04, 0.35, abs(dot(viewNormal, viewRayDirection)));
  }

  float stepLength = (rayEnd - rayStart) / float(uMaxSteps);
  float jitter = blueNoise(floor(gl_FragCoord.xy), uFrame + uTime * 60.0);
  float travel = rayStart + jitter * stepLength;
  vec3 scatteredLight = vec3(0.0);
  float transmittance = 1.0;

  for (int step = 0; step < 96; step += 1) {
    if (step >= uMaxSteps || travel > rayEnd || transmittance < 0.012) break;
    vec3 worldPosition = uCameraPosition + rayDirection * travel;
    vec3 volumeUv = (worldPosition - uVolumeCenter) / (uVolumeHalfExtent * 2.0) + 0.5;
    float density = texture(uDensityVolume, volumeUv).r;
    float pulseClear = 1.0;
    if (uPulseRadius > 0.0) {
      pulseClear = smoothstep(uPulseRadius * 0.65, uPulseRadius, distance(worldPosition, uPulsePosition));
    }
    density *= pulseClear * normalSoftness;
    if (density < 0.015) {
      travel += stepLength;
      continue;
    }

    float extinction = density * 1.8 * stepLength;
    vec3 cyanScattering = vec3(0.05, 0.52, 0.78) * density;
    vec3 violetScattering = vec3(0.35, 0.10, 0.66) * density * (0.45 + 0.55 * sin(worldPosition.y * 0.45 + uTime));
    float coreLight = exp(-dot(worldPosition, worldPosition) * 0.08);
    vec3 warmCoreLight = vec3(1.0, 0.24, 0.06) * coreLight * density;
    vec3 scattering = cyanScattering + violetScattering + warmCoreLight;
    float absorbed = 1.0 - exp(-extinction);
    scatteredLight += transmittance * scattering * absorbed;
    transmittance *= exp(-extinction);
    transmittance = min(transmittance, 1.0);
    travel += stepLength;
  }

  fragColor = vec4(scatteredLight, transmittance);
}`;

export const temporalFragmentShader = /* glsl */ `
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D tCurrent;
uniform sampler2D tHistory;
uniform sampler2D uSceneDepth;
uniform sampler2D uPreviousDepth;
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorldMatrix;
uniform mat4 uPreviousViewProjection;
uniform float uHasDepth;
uniform float uHistoryValid;
uniform float uHistoryWeight;

vec3 reconstructWorldPosition(vec2 uv, float depth) {
  vec4 clipPosition = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 viewPosition = uProjectionInverse * clipPosition;
  viewPosition /= max(viewPosition.w, 0.00001);
  return (uCameraWorldMatrix * viewPosition).xyz;
}

void main() {
  vec4 current = texture(tCurrent, vUv);
  if (uHasDepth < 0.5) {
    fragColor = current;
    return;
  }
  float currentDepth = texture(uSceneDepth, vUv).x;
  vec3 worldPosition = reconstructWorldPosition(vUv, currentDepth);
  vec4 previousClip = uPreviousViewProjection * vec4(worldPosition, 1.0);
  bool forwardProjection = previousClip.w > 0.0;
  vec3 previousNdc = previousClip.xyz / max(previousClip.w, 0.00001);
  bool insideNdc = all(greaterThanEqual(previousNdc, vec3(-1.0))) && all(lessThanEqual(previousNdc, vec3(1.0)));
  vec2 historyUv = previousNdc.xy * 0.5 + 0.5;
  float expectedPreviousDepth = previousNdc.z * 0.5 + 0.5;
  float previousDepth = texture(uPreviousDepth, clamp(historyUv, 0.0, 1.0)).x;
  float depthAgreement = step(abs(expectedPreviousDepth - previousDepth), 0.003);
  float historyAllowed = uHasDepth * uHistoryValid * float(forwardProjection && insideNdc) * depthAgreement;
  vec4 history = texture(tHistory, clamp(historyUv, 0.0, 1.0));
  fragColor = mix(current, history, historyAllowed * uHistoryWeight);
}`;

export const depthCopyFragmentShader = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uSceneDepth;
void main() { fragColor = vec4(vec3(texture(uSceneDepth, vUv).x), 1.0); }
`;

export const copyFragmentShader = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D tScene;
uniform sampler2D tVolume;
void main() {
  vec4 scene = texture(tScene, vUv);
  vec4 volume = texture(tVolume, vUv);
  fragColor = vec4(scene.rgb * volume.a + volume.rgb, scene.a);
}
`;
