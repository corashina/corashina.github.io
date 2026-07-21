import * as THREE from "three";

export type ProtoStarShaderUniforms = {
  uTime: { value: number };
  uEnergy: { value: number };
  uRelease: { value: number };
};
export type ProtoStarVertexShader = { uniforms: Record<string, { value: unknown }>; vertexShader: string };

const PROGRAM_KEY = "cosmic-genesis-proto-star-v1";
const PROTO_STAR_UNIFORM_NAMES = ["uTime", "uEnergy", "uRelease"] as const;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function injectVertexUniformDeclarations(source: string): string {
  const declarations = PROTO_STAR_UNIFORM_NAMES
    .filter((uniform) => !new RegExp(`uniform\\s+float\\s+${uniform}\\s*;`).test(source))
    .map((uniform) => `uniform float ${uniform};`)
    .join("\n");
  if (declarations.length === 0) return source;

  const commonAnchor = "#include <common>";
  if (source.includes(commonAnchor)) return source.replace(commonAnchor, `${commonAnchor}\n${declarations}`);
  return `${declarations}\n${source}`;
}

export function getProtoStarShaderUniforms(material: THREE.MeshPhysicalMaterial): ProtoStarShaderUniforms {
  return material.userData.protoStarShaderUniforms as ProtoStarShaderUniforms;
}

/** Shared vertex-only deformation contract for beauty, depth, and distance programs. */
export function augmentProtoStarVertexShader(shader: ProtoStarVertexShader, uniforms: ProtoStarShaderUniforms): void {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = injectVertexUniformDeclarations(shader.vertexShader).replace(
    "#include <begin_vertex>",
    `
      float protoStarNoise = sin(position.x * 9.0 + uTime * 1.7) * sin(position.y * 8.0 - uTime * 1.2) * sin(position.z * 10.0 + uTime);
      vec3 transformed = vec3(position) + normal * protoStarNoise * (0.018 + uEnergy * 0.045 + uRelease * 0.01);
    `,
  );
}

/** Creates a standard physical material with only local plasma/crystal shader augmentation. */
export function createProtoStarMaterial(): THREE.MeshPhysicalMaterial {
  const uniforms: ProtoStarShaderUniforms = {
    uTime: { value: 0 },
    uEnergy: { value: 0 },
    uRelease: { value: 0 },
  };
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffd2a2"),
    emissive: new THREE.Color("#ffb36a"),
    emissiveIntensity: 0.55,
    transmission: 0.18,
    thickness: 1.4,
    attenuationColor: new THREE.Color("#ff9c64"),
    attenuationDistance: 2.4,
    ior: 1.48,
    dispersion: 0.08,
    clearcoat: 0.65,
    clearcoatRoughness: 0.16,
    roughness: 0.28,
    metalness: 0.02,
  });

  material.userData.protoStarShaderUniforms = uniforms;
  material.customProgramCacheKey = () => PROGRAM_KEY;
  material.onBeforeCompile = (shader) => {
    augmentProtoStarVertexShader(shader, uniforms);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `
        #include <common>
        uniform float uTime;
        uniform float uEnergy;
        uniform float uRelease;
        float protoStarFresnel(vec3 viewDirection, vec3 surfaceNormal) {
          return pow(1.0 - max(dot(normalize(viewDirection), normalize(surfaceNormal)), 0.0), 3.0);
        }
      `,
    ).replace(
      "#include <emissivemap_fragment>",
      `
        #include <emissivemap_fragment>
        float protoStarPulse = 0.5 + 0.5 * sin(uTime * 2.4 + vViewPosition.y * 7.0);
        float protoStarRim = protoStarFresnel(-vViewPosition, normal);
        totalEmissiveRadiance += vec3(1.0, 0.34, 0.12) * (protoStarRim * (0.18 + uEnergy * 0.72) + protoStarPulse * uEnergy * 0.18 + uRelease * 0.08);
      `,
    );
  };
  return material;
}

/** Advances shader uniforms and interpolates the material from plasma to crystal. */
export function setProtoStarMaterialState(
  material: THREE.MeshPhysicalMaterial,
  elapsed: number,
  energy: number,
  release: boolean,
): void {
  const boundedEnergy = clampUnit(energy);
  const uniforms = getProtoStarShaderUniforms(material);
  uniforms.uTime.value = elapsed;
  uniforms.uEnergy.value = boundedEnergy;
  uniforms.uRelease.value = release ? 1 : 0;
  material.transmission = lerp(0.18, 0.92, boundedEnergy);
  material.roughness = lerp(0.28, 0.08, boundedEnergy);
  material.dispersion = lerp(0.08, 0.68, boundedEnergy);
  material.emissiveIntensity = lerp(0.55, 2.6, boundedEnergy);
}
