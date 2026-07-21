import * as THREE from "three";
import type { ShadowLevel } from "../quality/qualityProfiles";

type PcssState = {
  level: Exclude<ShadowLevel, "pcf">;
  onBeforeCompile: THREE.Material["onBeforeCompile"];
  customProgramCacheKey: THREE.Material["customProgramCacheKey"];
  wrapper: THREE.Material["onBeforeCompile"];
  keyWrapper: THREE.Material["customProgramCacheKey"];
};
const STATE_KEY = "cosmicGenesisPcssState";

function source(taps: 16 | 32): string {
  const ringSamples = taps / 2;
  return /* glsl */ `
// Ported from three.js r185 examples/webgl_shadowmap_pcss.html.
// Copyright three.js authors and PCSS example contributors. MIT License:
// https://github.com/mrdoob/three.js/blob/r185/LICENSE
#if defined( SHADOWMAP_TYPE_BASIC )
#define LIGHT_WORLD_SIZE 0.005
#define LIGHT_FRUSTUM_WIDTH 3.75
#define LIGHT_SIZE_UV ( LIGHT_WORLD_SIZE / LIGHT_FRUSTUM_WIDTH )
#define NEAR_PLANE 9.5
#define PCSS_FILTER_TAPS ${taps}
#define PCSS_RING_SAMPLES ${ringSamples}
#define PCSS_NUM_RINGS 11

vec2 poissonDisk[ PCSS_RING_SAMPLES ];

void initPoissonSamples( const in vec2 randomSeed ) {
  float angleStep = PI2 * float( PCSS_NUM_RINGS ) / float( PCSS_RING_SAMPLES );
  float inverseSamples = 1.0 / float( PCSS_RING_SAMPLES );
  float angle = rand( randomSeed ) * PI2;
  float radius = inverseSamples;
  for ( int i = 0; i < PCSS_RING_SAMPLES; i ++ ) {
    poissonDisk[ i ] = vec2( cos( angle ), sin( angle ) ) * pow( radius, 0.75 );
    radius += inverseSamples;
    angle += angleStep;
  }
}

float penumbraSize( const in float zReceiver, const in float zBlocker ) {
  return ( zReceiver - zBlocker ) / max( zBlocker, 0.0001 );
}

float findBlocker( sampler2D shadowMap, const in vec2 uv, const in float zReceiver ) {
  float searchRadius = LIGHT_SIZE_UV * max( zReceiver - NEAR_PLANE, 0.0 ) / max( zReceiver, 0.0001 );
  float blockerDepthSum = 0.0;
  int numBlockers = 0;
  for ( int i = 0; i < PCSS_RING_SAMPLES; i ++ ) {
    float shadowMapDepth = texture2D( shadowMap, uv + poissonDisk[ i ] * searchRadius ).r;
    if ( shadowMapDepth < zReceiver ) { blockerDepthSum += shadowMapDepth; numBlockers ++; }
  }
  if ( numBlockers == 0 ) return -1.0;
  return blockerDepthSum / float( numBlockers );
}

float pcssFilter( sampler2D shadowMap, vec2 uv, float zReceiver, float filterRadius ) {
  float sum = 0.0;
  for ( int i = 0; i < PCSS_RING_SAMPLES; i ++ ) {
    float depth = texture2D( shadowMap, uv + poissonDisk[ i ] * filterRadius ).r;
    if ( zReceiver <= depth ) sum += 1.0;
  }
  for ( int i = 0; i < PCSS_RING_SAMPLES; i ++ ) {
    float depth = texture2D( shadowMap, uv - poissonDisk[ i ].yx * filterRadius ).r;
    if ( zReceiver <= depth ) sum += 1.0;
  }
  return sum / float( PCSS_FILTER_TAPS );
}

float pcssShadow( sampler2D shadowMap, vec4 coords ) {
  vec2 uv = coords.xy;
  float zReceiver = coords.z;
  initPoissonSamples( uv );
  float avgBlockerDepth = findBlocker( shadowMap, uv, zReceiver );
  if ( avgBlockerDepth == -1.0 ) return 1.0;
  float penumbraRatio = penumbraSize( zReceiver, avgBlockerDepth );
  float filterRadius = penumbraRatio * LIGHT_SIZE_UV * NEAR_PLANE / max( zReceiver, 0.0001 );
  return pcssFilter( shadowMap, uv, zReceiver, filterRadius );
}

float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
  shadowCoord.xyz /= shadowCoord.w;
  #ifdef USE_REVERSED_DEPTH_BUFFER
    shadowCoord.z -= shadowBias;
  #else
    shadowCoord.z += shadowBias;
  #endif
  bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
  bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
  float shadow = frustumTest ? pcssShadow( shadowMap, shadowCoord ) : 1.0;
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
  if (material.onBeforeCompile === state.wrapper) material.onBeforeCompile = state.onBeforeCompile;
  if (material.customProgramCacheKey === state.keyWrapper) material.customProgramCacheKey = state.customProgramCacheKey;
  delete material.userData[STATE_KEY];
  material.needsUpdate = true;
}

/** Adds receiver-safe PCSS without replacing any existing deformation hook. */
export function applyPcss(material: THREE.Material, level: ShadowLevel): void {
  if (level === "pcf") { removePcss(material); return; }
  const existing = material.userData[STATE_KEY] as PcssState | undefined;
  if (existing?.level === level && material.onBeforeCompile === existing.wrapper && material.customProgramCacheKey === existing.keyWrapper) return;
  removePcss(material);
  const taps = level === "pcss-high" ? 32 : 16;
  const originalCallback = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey;
  const wrapper: THREE.Material["onBeforeCompile"] = function (this: THREE.Material, shader, renderer): void {
    originalCallback.call(this, shader, renderer);
    shader.fragmentShader = inject(shader.fragmentShader, taps);
  };
  const keyWrapper: THREE.Material["customProgramCacheKey"] = function (this: THREE.Material): string {
    return `${originalKey.call(this)}|cosmic-genesis-pcss-${level}-${taps}`;
  };
  const state: PcssState = { level, onBeforeCompile: originalCallback, customProgramCacheKey: originalKey, wrapper, keyWrapper };
  material.userData[STATE_KEY] = state;
  material.onBeforeCompile = wrapper;
  material.customProgramCacheKey = keyWrapper;
  material.needsUpdate = true;
}
