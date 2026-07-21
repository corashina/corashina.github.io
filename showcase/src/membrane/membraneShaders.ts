import * as THREE from "three";

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

type Uniform<T> = { value: T };

export type MembraneShaderUniforms = {
  uHeightTexture: Uniform<THREE.Texture>;
  uTexel: Uniform<THREE.Vector2>;
  uWorldTexel: Uniform<number>;
  uHeightScale: Uniform<number>;
  uDetailStrength: Uniform<number>;
};

type PhysicalShader = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};
export type MembraneVertexShader = Pick<PhysicalShader, "uniforms" | "vertexShader">;

const PROGRAM_KEY = "cosmic-genesis-membrane-physical-v2";

const vertexDeclarations = /* glsl */ `
uniform sampler2D uHeightTexture;
uniform vec2 uTexel;
uniform float uWorldTexel;
uniform float uHeightScale;
varying float vMembraneCurvature;
varying vec3 vMembraneWorldPosition;
`;

const displacementDeclarations = /* glsl */ `
uniform sampler2D uHeightTexture;
uniform float uHeightScale;
`;

const fragmentDeclarations = /* glsl */ `
uniform float uDetailStrength;
varying float vMembraneCurvature;
varying vec3 vMembraneWorldPosition;

float membraneDetailField(vec3 worldPosition) {
  float primary = sin(worldPosition.x * 18.0 + worldPosition.z * 3.0) * sin(worldPosition.z * 21.0 - worldPosition.x * 2.0);
  float secondary = sin((worldPosition.x + worldPosition.z) * 37.0) * 0.35;
  return primary + secondary;
}

vec3 membranePerturbNormal(vec3 surfacePosition, vec3 surfaceNormal, float height) {
  vec3 sigmaX = dFdx(surfacePosition);
  vec3 sigmaY = dFdy(surfacePosition);
  vec3 responseX = cross(sigmaY, surfaceNormal);
  vec3 responseY = cross(surfaceNormal, sigmaX);
  float determinant = dot(sigmaX, responseX);
  vec2 gradient = vec2(dFdx(height), dFdy(height));
  return normalize(abs(determinant) * surfaceNormal - sign(determinant) * (gradient.x * responseX + gradient.y * responseY));
}
`;

function injectAfterCommon(source: string, declarations: string): string {
  const anchor = "#include <common>";
  if (!source.includes(anchor)) return `${declarations}\n${source}`;
  return source.replace(anchor, `${anchor}\n${declarations}`);
}

/** Vertex-only displacement used by depth and point-light distance materials. */
export function augmentMembraneShadowVertexShader(shader: MembraneVertexShader, uniforms: MembraneShaderUniforms): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = injectAfterCommon(shader.vertexShader, displacementDeclarations).replace(
    "#include <begin_vertex>",
    /* glsl */ `
      #include <begin_vertex>
      float membraneHeight = texture2D(uHeightTexture, uv).r * uHeightScale;
      transformed += vec3(0.0, 0.0, membraneHeight);
    `,
  );
}

function augmentPhysicalShader(shader: PhysicalShader, uniforms: MembraneShaderUniforms): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = injectAfterCommon(shader.vertexShader, vertexDeclarations)
    .replace(
      "#include <beginnormal_vertex>",
      /* glsl */ `
        #include <beginnormal_vertex>
        float membraneHeightForNormal = texture2D(uHeightTexture, uv).r * uHeightScale;
        float heightEast = texture2D(uHeightTexture, uv + vec2(uTexel.x, 0.0)).r * uHeightScale;
        float heightWest = texture2D(uHeightTexture, uv - vec2(uTexel.x, 0.0)).r * uHeightScale;
        float heightNorth = texture2D(uHeightTexture, uv + vec2(0.0, uTexel.y)).r * uHeightScale;
        float heightSouth = texture2D(uHeightTexture, uv - vec2(0.0, uTexel.y)).r * uHeightScale;
        vec3 membraneTangentX = vec3(2.0 * uWorldTexel, 0.0, heightEast - heightWest);
        vec3 membraneTangentY = vec3(0.0, 2.0 * uWorldTexel, heightNorth - heightSouth);
        objectNormal = normalize(cross(membraneTangentX, membraneTangentY));
        vMembraneCurvature = abs(heightEast + heightWest + heightNorth + heightSouth - 4.0 * membraneHeightForNormal);
      `,
    )
    .replace(
      "#include <begin_vertex>",
      /* glsl */ `
        #include <begin_vertex>
        float membraneHeight = texture2D(uHeightTexture, uv).r * uHeightScale;
        transformed += vec3(0.0, 0.0, membraneHeight);
      `,
    )
    .replace(
      "#include <project_vertex>",
      /* glsl */ `
        #include <project_vertex>
        vMembraneWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      `,
    );

  shader.fragmentShader = injectAfterCommon(shader.fragmentShader, fragmentDeclarations)
    .replace(
      "#include <normal_fragment_maps>",
      /* glsl */ `
        #include <normal_fragment_maps>
        float membraneFineDetail = membraneDetailField(vMembraneWorldPosition) * uDetailStrength;
        normal = membranePerturbNormal(-vViewPosition, normal, membraneFineDetail);
      `,
    )
    .replace(
      "#include <lights_physical_fragment>",
      /* glsl */ `
        #include <lights_physical_fragment>
        float membraneCurvature = smoothstep(0.002, 0.16, vMembraneCurvature);
        vec3 membraneCyan = vec3(0.08, 0.92, 1.0);
        material.diffuseColor = mix(material.diffuseColor, membraneCyan, membraneCurvature * 0.28);
        material.diffuseContribution = material.diffuseColor * (1.0 - material.metalness);
        material.specularColorBlended = mix(material.specularColor, material.diffuseColor, material.metalness);
      `,
    )
    .replace(
      "#include <opaque_fragment>",
      /* glsl */ `
        float membraneFresnel = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 4.0);
        outgoingLight += membraneCyan * (membraneCurvature * 0.12 + membraneFresnel * 0.055);
        #include <opaque_fragment>
      `,
    );
}

export function getMembraneShaderUniforms(material: THREE.MeshPhysicalMaterial): MembraneShaderUniforms {
  return material.userData.membraneShaderUniforms as MembraneShaderUniforms;
}

/** Builds a physical surface and limits custom shader work to displacement and local response. */
export function createMembraneMaterial(
  resolution: number,
  worldSize: number,
  heightTexture: THREE.Texture,
): THREE.MeshPhysicalMaterial {
  const uniforms: MembraneShaderUniforms = {
    uHeightTexture: { value: heightTexture },
    uTexel: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
    uWorldTexel: { value: worldSize / (resolution - 1) },
    uHeightScale: { value: 1 },
    uDetailStrength: { value: 0.018 },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#07141d"),
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.32,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.25,
    transparent: false,
    depthWrite: true,
  });
  material.userData.membraneShaderUniforms = uniforms;
  material.customProgramCacheKey = () => PROGRAM_KEY;
  material.onBeforeCompile = (shader) => augmentPhysicalShader(shader as PhysicalShader, uniforms);
  return material;
}
