export const membraneComputeShader = /* glsl */ `
uniform float uDelta;
uniform float uTime;
uniform float uWaveSpeed;
uniform float uDamping;
uniform float uPulseEnergy;
uniform float uPulseRadius;
uniform float uMembraneY;
uniform vec2 uPointerUv;
uniform sampler2D uParticleTexture;
uniform vec2 uParticleSamples[8];

float sampleHeight(vec2 uv) {
  return texture2D(textureHeight, uv).r;
}

float particleImpact(vec2 uv, vec4 particle) {
  vec2 particleUv = particle.xz / 16.0 + 0.5;
  float planeDistance = abs(particle.y - uMembraneY);
  float radialDistance = length(uv - particleUv);
  return exp(-radialDistance * radialDistance * 900.0) * exp(-planeDistance * 7.0) * 0.045;
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 texel = 1.0 / resolution.xy;
  float center = sampleHeight(uv);
  float north = sampleHeight(uv + vec2(0.0, texel.y));
  float south = sampleHeight(uv - vec2(0.0, texel.y));
  float east = sampleHeight(uv + vec2(texel.x, 0.0));
  float west = sampleHeight(uv - vec2(texel.x, 0.0));
  float velocity = texture2D(textureHeight, uv).g;
  float laplacian = north + south + east + west - 4.0 * center;
  velocity += laplacian * uWaveSpeed * uDelta;
  velocity *= exp(-uDamping * uDelta);

  float ringDistance = abs(length(uv - uPointerUv) - uPulseRadius);
  float pulse = exp(-ringDistance * 120.0) * uPulseEnergy * 0.09;
  float impacts = particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[0]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[1]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[2]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[3]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[4]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[5]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[6]))
    + particleImpact(uv, texture2D(uParticleTexture, uParticleSamples[7]));
  float height = clamp(center + velocity * uDelta + pulse + impacts, -0.65, 0.65);
  gl_FragColor = vec4(height, velocity, 0.0, 1.0);
}
`;

export const membraneVertexShader = /* glsl */ `
uniform sampler2D uHeightTexture;
uniform vec2 uTexel;
uniform float uWorldTexel;
uniform float uHeightScale;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying float vCurvature;

float membraneHeight(vec2 uv) { return texture2D(uHeightTexture, uv).r * uHeightScale; }

void main() {
  float height = membraneHeight(uv);
  float heightEast = membraneHeight(uv + vec2(uTexel.x, 0.0));
  float heightWest = membraneHeight(uv - vec2(uTexel.x, 0.0));
  float heightNorth = membraneHeight(uv + vec2(0.0, uTexel.y));
  float heightSouth = membraneHeight(uv - vec2(0.0, uTexel.y));
  vec3 displaced = position + vec3(0.0, 0.0, height);
  vec3 tangentX = normalize(vec3(2.0 * uWorldTexel, 0.0, heightEast - heightWest));
  vec3 tangentZ = normalize(vec3(0.0, 2.0 * uWorldTexel, heightNorth - heightSouth));
  vec3 membraneNormal = normalize(cross(tangentX, tangentZ));
  vCurvature = abs(heightEast + heightWest + heightNorth + heightSouth - 4.0 * height);
  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * membraneNormal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const membraneFragmentShader = /* glsl */ `
uniform vec3 uEnvironmentColor;
uniform float uOpacity;
uniform float roughness;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying float vCurvature;

void main() {
  vec3 normal = normalize(vWorldNormal);
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float fresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 4.0);
  float curvature = smoothstep(0.002, 0.16, vCurvature);
  vec3 cyan = vec3(0.08, 0.92, 1.0);
  vec3 environment = uEnvironmentColor * (0.42 + 0.58 * max(normal.y, 0.0));
  vec3 physical = mix(environment * (1.0 - roughness), cyan, curvature * 0.72);
  vec3 color = physical + cyan * fresnel * (0.24 + curvature * 0.76);
  gl_FragColor = vec4(color, uOpacity);
}
`;
