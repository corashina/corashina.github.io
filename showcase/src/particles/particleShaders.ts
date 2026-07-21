export const particleVelocityShader = /* glsl */ `
uniform float uDelta;
uniform float uOrbitStrength;
uniform float uPointerGravity;
uniform float uPulseEnergy;
uniform float uPulseRadius;
uniform float uTurbulence;
uniform float uDrag;
uniform vec3 uCorePosition;
uniform vec3 uPointerPosition;

vec3 clampLength(vec3 vector, float maximumLength) {
  float vectorLength = length(vector);
  return vectorLength > maximumLength ? vector * (maximumLength / vectorLength) : vector;
}

vec3 curlNoise(vec3 point) {
  vec3 wave = vec3(
    sin(point.y * 1.73 + point.z * 0.91),
    sin(point.z * 1.41 + point.x * 1.27),
    sin(point.x * 1.19 + point.y * 1.61)
  );
  return clamp(cross(wave, vec3(0.71, 0.53, 0.39)), vec3(-1.0), vec3(1.0));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 position = texture2D(texturePosition, uv);
  vec4 velocity = texture2D(textureVelocity, uv);
  vec3 radial = position.xyz - uCorePosition;
  vec3 orbital = normalize(cross(vec3(0.0, 1.0, 0.0), radial)) * uOrbitStrength;
  vec3 curl = curlNoise(position.xyz * 0.42 + position.w * 9.0) * uTurbulence;
  vec3 pointerDelta = uPointerPosition - position.xyz;
  float pointerFalloff = exp(-dot(pointerDelta, pointerDelta) * 0.18);
  vec3 pointerForce = normalize(pointerDelta + 1e-5) * pointerFalloff * uPointerGravity;
  float pulseFalloff = exp(-abs(length(radial) - uPulseRadius) * 2.5);
  vec3 pulseForce = normalize(radial + 1e-5) * pulseFalloff * uPulseEnergy;
  velocity.xyz = clampLength((velocity.xyz + (orbital + curl + pointerForce + pulseForce) * uDelta) * exp(-uDelta * 0.18), 5.0);
  velocity.xyz *= exp(-uDelta * uDrag);
  gl_FragColor = velocity;
}
`;

export const particlePositionShader = /* glsl */ `
uniform float uDelta;
uniform vec3 uCorePosition;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 position = texture2D(texturePosition, uv);
  vec4 velocity = texture2D(textureVelocity, uv);
  position.xyz += velocity.xyz * uDelta;

  if (length(position.xyz) > 12.0) {
    float seedAngle = position.w * 6.28318530718;
    vec3 seededOrbit = vec3(cos(seedAngle), (position.w - 0.5) * 0.7, sin(seedAngle)) * (4.0 + position.w * 3.0);
    position.xyz = mix(position.xyz, uCorePosition + seededOrbit, 0.82);
  }

  gl_FragColor = position;
}
`;

export const particleVertexShader = /* glsl */ `
uniform sampler2D texturePosition;
uniform sampler2D uEnergyTexture;
uniform float uPointSize;
attribute vec2 lookup;
varying vec3 vEnergy;

void main() {
  vec4 computedPosition = texture2D(texturePosition, lookup);
  vEnergy = texture2D(uEnergyTexture, lookup).rgb;
  vec4 modelPosition = modelMatrix * vec4(computedPosition.xyz, 1.0);
  gl_Position = projectionMatrix * viewMatrix * modelPosition;
  gl_PointSize = uPointSize * (1.0 + computedPosition.w) / max(0.75, -modelPosition.z);
}
`;

export const particleFragmentShader = /* glsl */ `
varying vec3 vEnergy;
uniform float uOpacity;

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float radial = smoothstep(0.5, 0.0, length(centered));
  vec3 cyan = vec3(0.22, 0.95, 1.0);
  vec3 violet = vec3(0.72, 0.34, 1.0);
  vec3 gold = vec3(1.0, 0.72, 0.28);
  vec3 phaseColor = mix(cyan, violet, vEnergy.x);
  phaseColor = mix(phaseColor, gold, vEnergy.y * 0.65);
  gl_FragColor = vec4(phaseColor * radial, radial * (0.45 + vEnergy.z * 0.55) * uOpacity);
}
`;
