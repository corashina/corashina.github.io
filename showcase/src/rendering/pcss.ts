import * as THREE from "three";
import type { ShadowLevel } from "../quality/qualityProfiles";

type PcssState = {
  onBeforeCompile: THREE.Material["onBeforeCompile"];
  customProgramCacheKey: THREE.Material["customProgramCacheKey"];
};

const STATE_KEY = "cosmicGenesisPcssState";

function shaderSource(taps: 16 | 32): string {
  return /* glsl */ `
// PCSS blocker search and penumbra filter adapted from the three.js PCSS example.
// Copyright three.js authors. MIT License: https://github.com/mrdoob/three.js/blob/dev/LICENSE
#if defined( SHADOWMAP_TYPE_PCF )
  #define PCSS_FILTER_TAPS ${taps}
  float findBlocker( sampler2DShadow shadowMap, vec2 uv, float compare, vec2 texelSize ) {
    float blockers = 0.0;
    for ( int i = 0; i < PCSS_FILTER_TAPS; i ++ ) {
      float angle = 6.28318530718 * float( i ) / float( PCSS_FILTER_TAPS );
      vec2 offset = vec2( cos( angle ), sin( angle ) ) * texelSize * 4.0;
      blockers += 1.0 - texture( shadowMap, vec3( uv + offset, compare ) );
    }
    return blockers / float( PCSS_FILTER_TAPS );
  }

  float pcssFilter( sampler2DShadow shadowMap, vec2 uv, float compare, vec2 texelSize, float radius ) {
    float blockers = findBlocker( shadowMap, uv, compare, texelSize );
    float penumbra = radius * ( 1.0 + blockers * 6.0 );
    float shadow = 0.0;
    for ( int i = 0; i < PCSS_FILTER_TAPS; i ++ ) {
      float angle = 6.28318530718 * ( float( i ) + 0.5 ) / float( PCSS_FILTER_TAPS );
      vec2 offset = vec2( cos( angle ), sin( angle ) ) * texelSize * penumbra;
      shadow += texture( shadowMap, vec3( uv + offset, compare ) );
    }
    return shadow / float( PCSS_FILTER_TAPS );
  }

  float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
    shadowCoord.xyz /= shadowCoord.w;
    shadowCoord.z += shadowBias;
    bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
    float shadow = inFrustum && shadowCoord.z <= 1.0
      ? pcssFilter( shadowMap, shadowCoord.xy, shadowCoord.z, 1.0 / shadowMapSize, shadowRadius )
      : 1.0;
    return mix( 1.0, shadow, shadowIntensity );
  }
#endif
`;
}

function injectPcss(source: string, taps: 16 | 32): string {
  const anchor = "#include <shadowmap_pars_fragment>";
  if (!source.includes(anchor)) return source;
  return source.replace(anchor, /* glsl */ `
#if defined( SHADOWMAP_TYPE_PCF )
  #define getShadow cosmicGenesisBaseShadow
#endif
${anchor}
#if defined( SHADOWMAP_TYPE_PCF )
  #undef getShadow
#endif
${shaderSource(taps)}`);
}

function restore(material: THREE.Material): void {
  const state = material.userData[STATE_KEY] as PcssState | undefined;
  if (state === undefined) return;
  material.onBeforeCompile = state.onBeforeCompile;
  material.customProgramCacheKey = state.customProgramCacheKey;
  delete material.userData[STATE_KEY];
  material.needsUpdate = true;
}

/** Chains an idempotent PCSS shadow hook while preserving existing material augmentation. */
export function applyPcss(material: THREE.Material, level: ShadowLevel): void {
  if (level === "pcf") {
    restore(material);
    return;
  }

  const taps = level === "pcss-high" ? 32 : 16;
  const previousState = material.userData[STATE_KEY] as PcssState | undefined;
  if (previousState !== undefined) restore(material);
  const original: PcssState = {
    onBeforeCompile: material.onBeforeCompile,
    customProgramCacheKey: material.customProgramCacheKey,
  };
  material.userData[STATE_KEY] = original;
  material.onBeforeCompile = (shader, renderer) => {
    original.onBeforeCompile(shader, renderer);
    shader.fragmentShader = injectPcss(shader.fragmentShader, taps);
  };
  material.customProgramCacheKey = () => `${original.customProgramCacheKey()}|cosmic-genesis-pcss-${level}-${taps}`;
  material.needsUpdate = true;
}
