import * as THREE from "three";
import type { ShadowLevel } from "../quality/qualityProfiles";

type PcssState = { onBeforeCompile: THREE.Material["onBeforeCompile"]; customProgramCacheKey: THREE.Material["customProgramCacheKey"] };
const STATE_KEY = "cosmicGenesisPcssState";

function source(taps: 16 | 32): string {
  return /* glsl */ `
// PCSS algorithm ported from the three.js webgl_shadowmap_pcss example.
// Copyright three.js authors. MIT License: https://github.com/mrdoob/three.js/blob/dev/LICENSE
#if defined( SHADOWMAP_TYPE_BASIC )
#define PCSS_FILTER_TAPS ${taps}
vec2 pcssDisk( int index ) {
  float angle = 6.28318530718 * float( index ) / float( PCSS_FILTER_TAPS );
  return vec2( cos( angle ), sin( angle ) );
}
float findBlocker( sampler2D shadowMap, vec2 uv, float receiverDepth, vec2 texelSize, out float blockerCount ) {
  float blockerDepthSum = 0.0;
  blockerCount = 0.0;
  for ( int i = 0; i < PCSS_FILTER_TAPS; i ++ ) {
    float blockerDepth = texture2D( shadowMap, uv + pcssDisk( i ) * texelSize * 4.0 ).r;
    if ( blockerDepth < receiverDepth ) { blockerDepthSum += blockerDepth; blockerCount += 1.0; }
  }
  return blockerCount > 0.0 ? blockerDepthSum / blockerCount : 0.0;
}
float pcssFilter( sampler2D shadowMap, vec2 uv, float receiverDepth, vec2 texelSize, float radius ) {
  float blockerCount;
  float averageBlockerDepth = findBlocker( shadowMap, uv, receiverDepth, texelSize, blockerCount );
  if ( blockerCount == 0.0 ) return 1.0;
  float penumbra = ( receiverDepth - averageBlockerDepth ) / max( averageBlockerDepth, 0.0001 );
  float filterRadius = max( 1.0, penumbra * radius * 32.0 );
  float shadow = 0.0;
  for ( int i = 0; i < PCSS_FILTER_TAPS; i ++ ) {
    float depth = texture2D( shadowMap, uv + pcssDisk( i ) * texelSize * filterRadius ).r;
    shadow += step( receiverDepth, depth );
  }
  return shadow / float( PCSS_FILTER_TAPS );
}
float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
  shadowCoord.xyz /= shadowCoord.w;
  shadowCoord.z += shadowBias;
  bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
  float shadow = inFrustum && shadowCoord.z <= 1.0 ? pcssFilter( shadowMap, shadowCoord.xy, shadowCoord.z, 1.0 / shadowMapSize, shadowRadius ) : 1.0;
  return mix( 1.0, shadow, shadowIntensity );
}
#endif`;
}

function inject(fragmentShader: string, taps: 16 | 32): string {
  const anchor = "#include <shadowmap_pars_fragment>";
  if (!fragmentShader.includes(anchor)) return fragmentShader;
  return fragmentShader.replace(anchor, `
#if defined( SHADOWMAP_TYPE_BASIC )
#define getShadow cosmicGenesisBaseShadow
#endif
${anchor}
#if defined( SHADOWMAP_TYPE_BASIC )
#undef getShadow
#endif
${source(taps)}`);
}

export function removePcss(material: THREE.Material): void {
  const state = material.userData[STATE_KEY] as PcssState | undefined;
  if (state === undefined) return;
  material.onBeforeCompile = state.onBeforeCompile;
  material.customProgramCacheKey = state.customProgramCacheKey;
  delete material.userData[STATE_KEY];
  material.needsUpdate = true;
}

/** Adds a receiver/blocker PCSS implementation without replacing existing shader hooks. */
export function applyPcss(material: THREE.Material, level: ShadowLevel): void {
  if (level === "pcf") { removePcss(material); return; }
  removePcss(material);
  const taps = level === "pcss-high" ? 32 : 16;
  const original: PcssState = { onBeforeCompile: material.onBeforeCompile, customProgramCacheKey: material.customProgramCacheKey };
  material.userData[STATE_KEY] = original;
  material.onBeforeCompile = function (this: THREE.Material, shader, renderer): void {
    original.onBeforeCompile.call(this, shader, renderer);
    shader.fragmentShader = inject(shader.fragmentShader, taps);
  };
  material.customProgramCacheKey = function (this: THREE.Material): string {
    return `${original.customProgramCacheKey.call(this)}|cosmic-genesis-pcss-${level}-${taps}`;
  };
  material.needsUpdate = true;
}
