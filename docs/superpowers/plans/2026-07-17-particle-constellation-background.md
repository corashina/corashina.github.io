# Particle Constellation Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wireframe terrain with a dense, GPU-driven monochrome constellation containing up to 10,000 ambient particles, 128 instanced signal nodes, bounded links, and cursor-reactive motion.

**Architecture:** `BackgroundCanvas` keeps the React lifecycle boundary. `backgroundScene` manages Three.js timing, themes, adaptive quality, and disposal; `particleField` owns deterministic data and render objects; `particleShaders` owns GPU motion and presentation. Static buffer attributes and shader uniforms keep per-frame work off the CPU.

**Tech Stack:** React 19, TypeScript 7, Three.js 0.185, GLSL, Vitest, Testing Library, Sass

## Global Constraints

- Keep the scene monochrome in dark and light themes.
- Render 10,000 ambient particles, 128 signal nodes, and 3,200 links at high quality.
- Render 6,000 ambient particles, 80 signal nodes, and 1,800 links at medium quality.
- Render 3,000 ambient particles, 48 signal nodes, and 900 links at low quality.
- Use one `THREE.Points` draw call for ambient particles and one instanced draw call for signal nodes.
- Keep connection work bounded; do not run an all-pairs proximity search.
- Run motion, clustering, pointer displacement, and depth sizing in shaders.
- Keep the existing CSS fallback, hidden-tab pause, device-pixel-ratio cap, reduced-motion frame, and one-time disposal behavior.
- Add no runtime dependency.

## File Map

- Create `src/three/particleField.ts`: quality profiles, deterministic attributes, connection candidates, render-object construction, quality ranges, uniforms, and disposal.
- Create `src/three/particleField.test.ts`: deterministic data, quality selection, connection bounds, render structure, draw budgets, and disposal tests.
- Create `src/three/particleShaders.ts`: ambient, signal-node, and connection shaders plus their shared motion function.
- Create `src/three/particleShaders.test.ts`: shader interface and behavior-contract tests.
- Modify `src/three/backgroundScene.ts`: replace terrain meshes, add pointer speed, interpolate the expanded palette, monitor frame budget, and control quality transitions.
- Modify `src/three/backgroundScene.test.ts`: replace terrain assertions with constellation, palette, pointer-energy, quality, static-render, failure, and cleanup assertions.
- Delete `src/three/shaders.ts`: remove the terrain shaders after `backgroundScene.ts` uses `particleShaders.ts` through `particleField.ts`.
- Modify `src/components/BackgroundCanvas.tsx`: calculate pointer speed and supply the dark and light constellation palettes.
- Modify `src/components/BackgroundCanvas.test.tsx`: verify pointer speed, palette mapping, reduced motion, and lifecycle behavior.
- Modify `src/styles/canvas.module.scss`: tune final canvas opacity for the denser scene.

---

### Task 1: Deterministic Particle Data and Quality Budgets

**Files:**
- Create: `src/three/particleField.ts`
- Create: `src/three/particleField.test.ts`

**Interfaces:**
- Produces: `QualityTier`, `QualityProfile`, `QUALITY_PROFILES`, `selectQualityTier(width, height, pixelRatio, hardwareConcurrency)`, `lowerQuality(tier)`, `createParticleData(count, seed)`, and `createConnectionData(particles, budget, seed)`.
- Consumes: Three.js typed-buffer conventions; no earlier task dependency.

- [ ] **Step 1: Write failing tests for exact budgets and quality selection**

```ts
import { describe, expect, it, vi } from "vitest";
import {
  QUALITY_PROFILES,
  lowerQuality,
  selectQualityTier,
} from "./particleField";

describe("particle quality", () => {
  it("exposes the approved draw budgets", () => {
    expect(QUALITY_PROFILES).toEqual({
      low: { particles: 3_000, signalNodes: 48, connections: 900 },
      medium: { particles: 6_000, signalNodes: 80, connections: 1_800 },
      high: { particles: 10_000, signalNodes: 128, connections: 3_200 },
    });
  });

  it.each([
    { width: 390, height: 844, ratio: 3, cores: 8, expected: "low" },
    { width: 900, height: 700, ratio: 2, cores: 8, expected: "medium" },
    { width: 1440, height: 900, ratio: 1.5, cores: 12, expected: "high" },
    { width: 1440, height: 900, ratio: 1.5, cores: 4, expected: "low" },
  ] as const)("selects $expected quality", ({ width, height, ratio, cores, expected }) => {
    expect(selectQualityTier(width, height, ratio, cores)).toBe(expected);
  });

  it("only lowers a tier", () => {
    expect(lowerQuality("high")).toBe("medium");
    expect(lowerQuality("medium")).toBe("low");
    expect(lowerQuality("low")).toBe("low");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `npm test -- src/three/particleField.test.ts`

Expected: FAIL because `./particleField` does not exist.

- [ ] **Step 3: Add the quality types and selectors**

```ts
export type QualityTier = "low" | "medium" | "high";

export type QualityProfile = {
  particles: number;
  signalNodes: number;
  connections: number;
};

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  low: { particles: 3_000, signalNodes: 48, connections: 900 },
  medium: { particles: 6_000, signalNodes: 80, connections: 1_800 },
  high: { particles: 10_000, signalNodes: 128, connections: 3_200 },
};

export function selectQualityTier(
  width: number,
  height: number,
  pixelRatio: number,
  hardwareConcurrency: number,
): QualityTier {
  const pixels = width * height * Math.min(Math.max(pixelRatio, 1), 2);
  if (width < 640 || hardwareConcurrency <= 4 || pixels > 4_800_000) return "low";
  if (width < 1_200 || hardwareConcurrency <= 8 || pixels > 2_600_000) return "medium";
  return "high";
}

export function lowerQuality(tier: QualityTier): QualityTier {
  if (tier === "high") return "medium";
  if (tier === "medium") return "low";
  return "low";
}
```

- [ ] **Step 4: Add failing deterministic-data and bounded-connection tests**

```ts
import { createConnectionData, createParticleData } from "./particleField";

describe("particle data", () => {
  it("creates repeatable tier-ordered attributes", () => {
    const first = createParticleData(10_000, 42);
    const second = createParticleData(10_000, 42);

    expect(first.positions).toEqual(second.positions);
    expect(first.seeds).toEqual(second.seeds);
    expect(first.clusters).toEqual(second.clusters);
    expect(first.levels.slice(0, 3_000).every((value) => value === 0)).toBe(true);
    expect(first.levels.slice(3_000, 6_000).every((value) => value === 1)).toBe(true);
    expect(first.levels.slice(6_000).every((value) => value === 2)).toBe(true);
  });

  it("creates the requested number of cluster-local, non-self links", () => {
    const particles = createParticleData(10_000, 42);
    const links = createConnectionData(particles, 3_200, 91);

    expect(links.indices).toHaveLength(6_400);
    expect(links.phases).toHaveLength(6_400);
    expect(links.levels).toHaveLength(6_400);
    for (let edge = 0; edge < 3_200; edge += 1) {
      const source = links.indices[edge * 2];
      const target = links.indices[edge * 2 + 1];
      const level = links.levels[edge * 2];
      const particleLimit = [3_000, 6_000, 10_000][level];
      expect(source).toBeLessThan(10_000);
      expect(target).toBeLessThan(10_000);
      expect(source).toBeLessThan(particleLimit);
      expect(target).toBeLessThan(particleLimit);
      expect(source).not.toBe(target);
      expect(particles.clusters[source]).toBe(particles.clusters[target]);
    }
  });
});
```

- [ ] **Step 5: Implement seeded attributes and bounded links**

```ts
export type ParticleData = {
  positions: Float32Array;
  seeds: Float32Array;
  clusters: Uint8Array;
  levels: Uint8Array;
};

export type ConnectionData = {
  indices: Uint32Array;
  phases: Float32Array;
  levels: Uint8Array;
};

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function createParticleData(count: number, seed: number): ParticleData {
  const random = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const clusters = new Uint8Array(count);
  const levels = new Uint8Array(count);

  for (let index = 0; index < count; index += 1) {
    const cluster = Math.floor(random() * 24);
    const clusterAngle = (cluster / 24) * Math.PI * 2;
    const clusterRadius = 180 + (cluster % 6) * 220;
    const centerX = Math.cos(clusterAngle) * clusterRadius;
    const centerY = Math.sin(clusterAngle) * clusterRadius * 0.58;
    const jitterRadius = Math.sqrt(random()) * (130 + (cluster % 4) * 28);
    const jitterAngle = random() * Math.PI * 2;
    positions[index * 3] = centerX + Math.cos(jitterAngle) * jitterRadius;
    positions[index * 3 + 1] = centerY + Math.sin(jitterAngle) * jitterRadius;
    positions[index * 3 + 2] = (random() - 0.5) * 900;
    seeds.set([random(), random(), 0.55 + random() * 1.45, cluster / 23], index * 4);
    clusters[index] = cluster;
    levels[index] = index < 3_000 ? 0 : index < 6_000 ? 1 : 2;
  }

  return { positions, seeds, clusters, levels };
}

export function createConnectionData(
  particles: ParticleData,
  budget: number,
  seed: number,
): ConnectionData {
  const random = mulberry32(seed);
  const tierLimits = [
    QUALITY_PROFILES.low.particles,
    QUALITY_PROFILES.medium.particles,
    QUALITY_PROFILES.high.particles,
  ];
  const membersByLevel = tierLimits.map((limit) => {
    const groups = Array.from({ length: 24 }, () => [] as number[]);
    for (let index = 0; index < limit; index += 1) {
      groups[particles.clusters[index]].push(index);
    }
    return groups;
  });
  const indices = new Uint32Array(budget * 2);
  const phases = new Float32Array(budget * 2);
  const levels = new Uint8Array(budget * 2);

  for (let edge = 0; edge < budget; edge += 1) {
    const level = edge < 900 ? 0 : edge < 1_800 ? 1 : 2;
    const groups = membersByLevel[level];
    const group = groups[edge % groups.length];
    const sourceOffset = Math.floor(random() * group.length);
    const distance = 1 + Math.floor(random() * Math.min(12, group.length - 1));
    const source = group[sourceOffset];
    const target = group[(sourceOffset + distance) % group.length];
    const phase = random();
    indices.set([source, target], edge * 2);
    phases.set([phase, phase], edge * 2);
    levels.set([level, level], edge * 2);
  }

  return { indices, phases, levels };
}
```

- [ ] **Step 6: Run the focused tests and type checker**

Run: `npm test -- src/three/particleField.test.ts && npm run typecheck`

Expected: PASS with all particle-field tests green and no TypeScript errors.

- [ ] **Step 7: Commit the data foundation**

```bash
git add src/three/particleField.ts src/three/particleField.test.ts
git commit -m "feat: add constellation particle data"
```

---

### Task 2: GPU Motion and Presentation Shaders

**Files:**
- Create: `src/three/particleShaders.ts`
- Create: `src/three/particleShaders.test.ts`

**Interfaces:**
- Consumes: `position`, `aSeed`, `aLevel`, `aAnchor`, `aSignalSeed`, `aEndpoint`, `aEndpointSeed`, `aEdgePhase`, and the standard Three.js matrices.
- Produces: `ambientVertexShader`, `ambientFragmentShader`, `signalVertexShader`, `signalFragmentShader`, `connectionVertexShader`, and `connectionFragmentShader`.

- [ ] **Step 1: Write shader-contract tests**

```ts
import { describe, expect, it } from "vitest";
import {
  ambientFragmentShader,
  ambientVertexShader,
  connectionFragmentShader,
  connectionVertexShader,
  signalFragmentShader,
  signalVertexShader,
} from "./particleShaders";

describe("constellation shaders", () => {
  it("moves ambient particles through a pointer-reactive cluster field", () => {
    expect(ambientVertexShader).toContain("attribute vec4 aSeed");
    expect(ambientVertexShader).toContain("attribute float aLevel");
    expect(ambientVertexShader).toContain("displacedPosition");
    expect(ambientVertexShader).toContain("uPointerSpeed");
    expect(ambientVertexShader).toContain("uContentMask");
    expect(ambientFragmentShader).toContain("gl_PointCoord");
    expect(ambientVertexShader).toContain("uQualityMix");
  });

  it("renders instanced signal halos with stretched trails", () => {
    expect(signalVertexShader).toContain("attribute vec3 aAnchor");
    expect(signalVertexShader).toContain("attribute vec4 aSignalSeed");
    expect(signalVertexShader).toContain("uPointerSpeed");
    expect(signalFragmentShader).toContain("vEnergy");
    expect(signalFragmentShader).toContain("vTrail");
  });

  it("moves and pulses bounded connection endpoints", () => {
    expect(connectionVertexShader).toContain("attribute vec3 aEndpoint");
    expect(connectionVertexShader).toContain("attribute vec4 aEndpointSeed");
    expect(connectionVertexShader).toContain("attribute float aEdgePhase");
    expect(connectionFragmentShader).toContain("vSignal");
  });
});
```

- [ ] **Step 2: Run the shader test and confirm the missing-module failure**

Run: `npm test -- src/three/particleShaders.test.ts`

Expected: FAIL because `./particleShaders` does not exist.

- [ ] **Step 3: Implement the shared motion chunk and ambient shaders**

Create `particleShaders.ts` with a `motionChunk` that both ambient and connection vertex shaders embed. Use these exact uniforms and formulas:

```ts
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
```

- [ ] **Step 4: Add the signal-node and connection shaders**

Use an instanced quad for each signal. Stretch its local x-axis by pointer energy and pulse phase. Move connection endpoints with the same `displacedPosition` function.

```ts
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
  float trail = exp(-abs(centered.y) * 18.0) * smoothstep(0.52, 0.0, vUv.x) * vTrail;
  gl_FragColor = vec4(uSignalColor, (radial * (0.28 + vEnergy * 0.72) + trail * 0.3) * vEnergy);
}`;

export const connectionVertexShader = `
attribute vec3 aEndpoint;
attribute vec4 aEndpointSeed;
attribute float aEdgePhase;
attribute float aLevel;
uniform float uQualityMix;
varying float vSignal;
${motionChunk}
void main() {
  vec3 moved = displacedPosition(aEndpoint, aEndpointSeed);
  float pulse = 0.5 + 0.5 * sin(uTime * 1.1 - aEdgePhase * 20.0);
  float tierAlpha = 1.0 - smoothstep(uQualityMix + 0.02, uQualityMix + 0.32, aLevel);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(moved, 1.0);
  vec2 screen = clip.xy / max(clip.w, 0.0001) * 0.5 + 0.5;
  vSignal = pulse * tierAlpha * contentVisibility(screen);
  gl_Position = clip;
}`;

export const connectionFragmentShader = `
uniform vec3 uConnectionColor;
varying float vSignal;
void main() {
  gl_FragColor = vec4(uConnectionColor, 0.025 + vSignal * 0.16);
}`;
```

- [ ] **Step 5: Run shader tests and type checking**

Run: `npm test -- src/three/particleShaders.test.ts && npm run typecheck`

Expected: PASS with three shader-contract tests green and no TypeScript errors.

- [ ] **Step 6: Commit the shader suite**

```bash
git add src/three/particleShaders.ts src/three/particleShaders.test.ts
git commit -m "feat: add constellation shaders"
```

---

### Task 3: Batched Particle, Signal, and Connection Objects

**Files:**
- Modify: `src/three/particleField.ts`
- Modify: `src/three/particleField.test.ts`

**Interfaces:**
- Consumes: all shader exports from Task 2 and the data helpers from Task 1.
- Produces: `ParticlePalette`, `ParticleBlendMode`, `ParticleFieldController`, and `createParticleField(initialTier)`.

- [ ] **Step 1: Write failing render-structure and quality-range tests**

```ts
import * as THREE from "three";
import { createParticleField } from "./particleField";

describe("particle render field", () => {
  it("creates one points field, one instanced signal mesh, and one line batch", () => {
    const field = createParticleField("high");
    expect(field.group.children).toHaveLength(3);
    expect(field.group.children[0]).toBeInstanceOf(THREE.Points);
    expect((field.group.children[1] as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.InstancedBufferGeometry,
    );
    expect(field.group.children[2]).toBeInstanceOf(THREE.LineSegments);
    field.dispose();
  });

  it("applies exact draw budgets for each quality tier", () => {
    const field = createParticleField("high");
    field.setQuality("medium");
    expect(field.getDrawCounts()).toEqual({ particles: 6_000, signalNodes: 80, connections: 1_800 });
    field.setQuality("low");
    expect(field.getDrawCounts()).toEqual({ particles: 3_000, signalNodes: 48, connections: 900 });
    field.dispose();
  });

  it("updates shared motion, palette, and quality uniforms", () => {
    const field = createParticleField("high");
    field.setTime(4.5);
    field.setPointer(120, -80, 0.7);
    field.setQualityMix(1.4);
    field.setColors({ particle: "#aaaaaa", signal: "#ffffff", connection: "#777777" });
    field.setBlendMode("normal");
    expect(field.inspectUniforms()).toMatchObject({ time: 4.5, pointerSpeed: 0.7, qualityMix: 1.4 });
    expect(((field.group.children[0] as THREE.Points).material as THREE.ShaderMaterial).blending).toBe(
      THREE.NormalBlending,
    );
    field.dispose();
  });

  it("disposes each geometry and material once", () => {
    const field = createParticleField("high");
    const resources = field.group.children.flatMap((child) => {
      const renderable = child as THREE.Points | THREE.Mesh | THREE.LineSegments;
      return [renderable.geometry, renderable.material];
    });
    const spies = resources.map((resource) => vi.spyOn(resource as THREE.BufferGeometry, "dispose"));
    field.dispose();
    field.dispose();
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });
});
```

- [ ] **Step 2: Run the focused test and confirm missing exports**

Run: `npm test -- src/three/particleField.test.ts`

Expected: FAIL because `createParticleField` and its controller types do not exist.

- [ ] **Step 3: Build ambient and signal geometries**

Append the following public interfaces and create all buffers from the high-quality data set. Copy each signal node's anchor and seed into instanced attributes; assign levels `0`, `1`, and `2` in the same tier order as ambient particles.

```ts
export type ParticlePalette = {
  particle: THREE.ColorRepresentation;
  signal: THREE.ColorRepresentation;
  connection: THREE.ColorRepresentation;
};

export type ParticleBlendMode = "additive" | "normal";

export type ParticleFieldController = {
  group: THREE.Group;
  setTime(value: number): void;
  setPointer(x: number, y: number, speed: number): void;
  setContentMask(x: number, y: number, width: number, height: number): void;
  setColors(colors: ParticlePalette): void;
  setBlendMode(mode: ParticleBlendMode): void;
  setQuality(tier: QualityTier): void;
  setQualityMix(value: number): void;
  getDrawCounts(): QualityProfile;
  inspectUniforms(): { time: number; pointerSpeed: number; qualityMix: number };
  dispose(): void;
};
```

Create ambient geometry with `position`, `aSeed`, and `aLevel`. Create a unit `PlaneGeometry`, copy its attributes and index into an `InstancedBufferGeometry`, then add `aAnchor`, `aSignalSeed`, and `aLevel` as `InstancedBufferAttribute` values. Select signal anchors in tier order: ambient indices `0..47` for low, `3000..3031` for medium, and `6000..6047` for high. Set `instanceCount` from the active profile.

Use `ShaderMaterial` with `transparent: true`, `depthWrite: false`, `blending: THREE.AdditiveBlending`, and `toneMapped: false` for ambient and signal materials. Implement `setBlendMode` by assigning `THREE.AdditiveBlending` for `"additive"` and `THREE.NormalBlending` for `"normal"` to all three materials, then set each material's `needsUpdate` flag.

Start `createParticleField` with these imports, shared uniforms, and geometry assignments:

```ts
import * as THREE from "three";
import {
  ambientFragmentShader,
  ambientVertexShader,
  connectionFragmentShader,
  connectionVertexShader,
  signalFragmentShader,
  signalVertexShader,
} from "./particleShaders";

export function createParticleField(initialTier: QualityTier): ParticleFieldController {
  const particleData = createParticleData(QUALITY_PROFILES.high.particles, 0x51a7);
  const connectionData = createConnectionData(
    particleData,
    QUALITY_PROFILES.high.connections,
    0xc011,
  );
  const time = { value: 0 };
  const pointer = { value: new THREE.Vector3() };
  const pointerSpeed = { value: 0 };
  const contentMask = { value: new THREE.Vector4(0.5, 0.5, 0.24, 0.38) };
  const qualityMix = { value: initialTier === "high" ? 2 : initialTier === "medium" ? 1 : 0 };
  const particleColor = { value: new THREE.Color("#aeb4ba") };
  const signalColor = { value: new THREE.Color("#f4f6f7") };
  const connectionColor = { value: new THREE.Color("#697078") };
  const motionUniforms = {
    uTime: time,
    uPointer: pointer,
    uPointerSpeed: pointerSpeed,
    uContentMask: contentMask,
    uQualityMix: qualityMix,
  };

  const ambientGeometry = new THREE.BufferGeometry();
  ambientGeometry.setAttribute("position", new THREE.BufferAttribute(particleData.positions, 3));
  ambientGeometry.setAttribute("aSeed", new THREE.BufferAttribute(particleData.seeds, 4));
  ambientGeometry.setAttribute("aLevel", new THREE.BufferAttribute(particleData.levels, 1));
  const ambientMaterial = new THREE.ShaderMaterial({
    vertexShader: ambientVertexShader,
    fragmentShader: ambientFragmentShader,
    uniforms: { ...motionUniforms, uParticleColor: particleColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const ambient = new THREE.Points(ambientGeometry, ambientMaterial);
  ambient.frustumCulled = false;

  const signalIndices = [
    ...Array.from({ length: 48 }, (_, index) => index),
    ...Array.from({ length: 32 }, (_, index) => 3_000 + index),
    ...Array.from({ length: 48 }, (_, index) => 6_000 + index),
  ];
  const anchors = new Float32Array(signalIndices.length * 3);
  const signalSeeds = new Float32Array(signalIndices.length * 4);
  const signalLevels = new Uint8Array(signalIndices.length);
  signalIndices.forEach((particleIndex, signalIndex) => {
    anchors.set(particleData.positions.subarray(particleIndex * 3, particleIndex * 3 + 3), signalIndex * 3);
    signalSeeds.set(particleData.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4), signalIndex * 4);
    signalLevels[signalIndex] = signalIndex < 48 ? 0 : signalIndex < 80 ? 1 : 2;
  });

  const quad = new THREE.PlaneGeometry(2, 2);
  const signalGeometry = new THREE.InstancedBufferGeometry().copy(quad);
  quad.dispose();
  signalGeometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchors, 3));
  signalGeometry.setAttribute("aSignalSeed", new THREE.InstancedBufferAttribute(signalSeeds, 4));
  signalGeometry.setAttribute("aLevel", new THREE.InstancedBufferAttribute(signalLevels, 1));
  const signalMaterial = new THREE.ShaderMaterial({
    vertexShader: signalVertexShader,
    fragmentShader: signalFragmentShader,
    uniforms: { ...motionUniforms, uSignalColor: signalColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const signals = new THREE.Mesh(signalGeometry, signalMaterial);
  signals.frustumCulled = false;
```

- [ ] **Step 4: Build connection geometry and the controller**

Expand each connection index into two vertices. Copy the endpoint position, endpoint seed, shared edge phase, and connection level to `aEndpoint`, `aEndpointSeed`, `aEdgePhase`, and `aLevel`. Create one `THREE.LineSegments` object with transparent additive blending.

```ts
  const endpointPositions = new Float32Array(connectionData.indices.length * 3);
  const endpointSeeds = new Float32Array(connectionData.indices.length * 4);
  connectionData.indices.forEach((particleIndex, endpointIndex) => {
    endpointPositions.set(
      particleData.positions.subarray(particleIndex * 3, particleIndex * 3 + 3),
      endpointIndex * 3,
    );
    endpointSeeds.set(
      particleData.seeds.subarray(particleIndex * 4, particleIndex * 4 + 4),
      endpointIndex * 4,
    );
  });
  const connectionGeometry = new THREE.BufferGeometry();
  connectionGeometry.setAttribute("position", new THREE.BufferAttribute(endpointPositions, 3));
  connectionGeometry.setAttribute("aEndpoint", new THREE.BufferAttribute(endpointPositions, 3));
  connectionGeometry.setAttribute("aEndpointSeed", new THREE.BufferAttribute(endpointSeeds, 4));
  connectionGeometry.setAttribute("aEdgePhase", new THREE.BufferAttribute(connectionData.phases, 1));
  connectionGeometry.setAttribute("aLevel", new THREE.BufferAttribute(connectionData.levels, 1));
  const connectionMaterial = new THREE.ShaderMaterial({
    vertexShader: connectionVertexShader,
    fragmentShader: connectionFragmentShader,
    uniforms: { ...motionUniforms, uConnectionColor: connectionColor },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const connections = new THREE.LineSegments(connectionGeometry, connectionMaterial);
  connections.frustumCulled = false;
  const group = new THREE.Group();
  group.add(ambient, signals, connections);
```

Use shared uniform objects so `setTime`, `setPointer`, `setContentMask`, and `setQualityMix` update each material through one assignment. The controller below applies the three draw limits together.

Implement one-time disposal with a boolean guard. Remove the three children from the group, dispose their geometries, and dispose their materials.

Finish the function with one controller that owns the active profile and all resource changes:

```ts
  const materials = [ambientMaterial, signalMaterial, connectionMaterial];
  let currentProfile = QUALITY_PROFILES[initialTier];
  let disposed = false;

  const applyQuality = (profile: QualityProfile): void => {
    ambientGeometry.setDrawRange(0, profile.particles);
    signalGeometry.instanceCount = profile.signalNodes;
    connectionGeometry.setDrawRange(0, profile.connections * 2);
    currentProfile = profile;
  };
  applyQuality(currentProfile);

  return {
    group,
    setTime: (value) => { time.value = value; },
    setPointer: (x, y, speed) => { pointer.value.set(x, y, 0); pointerSpeed.value = speed; },
    setContentMask: (x, y, width, height) => { contentMask.value.set(x, y, width, height); },
    setColors: (colors) => {
      particleColor.value.set(colors.particle);
      signalColor.value.set(colors.signal);
      connectionColor.value.set(colors.connection);
    },
    setBlendMode: (mode) => {
      const blending = mode === "additive" ? THREE.AdditiveBlending : THREE.NormalBlending;
      materials.forEach((material) => { material.blending = blending; material.needsUpdate = true; });
    },
    setQuality: (tier) => applyQuality(QUALITY_PROFILES[tier]),
    setQualityMix: (value) => { qualityMix.value = value; },
    getDrawCounts: () => ({ ...currentProfile }),
    inspectUniforms: () => ({
      time: time.value,
      pointerSpeed: pointerSpeed.value,
      qualityMix: qualityMix.value,
    }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.remove(ambient, signals, connections);
      ambientGeometry.dispose();
      signalGeometry.dispose();
      connectionGeometry.dispose();
      materials.forEach((material) => material.dispose());
    },
  };
}
```

- [ ] **Step 5: Run particle-field and shader tests**

Run: `npm test -- src/three/particleField.test.ts src/three/particleShaders.test.ts && npm run typecheck`

Expected: PASS with the data, shader, render-structure, quality, uniform, and disposal tests green.

- [ ] **Step 6: Commit the render bundle**

```bash
git add src/three/particleField.ts src/three/particleField.test.ts
git commit -m "feat: build batched constellation field"
```

---

### Task 4: Scene Lifecycle, Themes, Pointer Energy, and Adaptive Quality

**Files:**
- Modify: `src/three/backgroundScene.ts:4-211`
- Modify: `src/three/backgroundScene.test.ts:1-276`
- Delete: `src/three/shaders.ts`

**Interfaces:**
- Consumes: `createParticleField`, `lowerQuality`, `selectQualityTier`, `ParticleBlendMode`, `ParticlePalette`, and `QualityTier` from Task 1 and Task 3.
- Produces: the updated `SceneTheme`, `BackgroundController.setPointer(x, y, speed)`, `normalizePointerSpeed(deltaX, deltaY, deltaMs, rect)`, and the existing scene lifecycle methods.

- [ ] **Step 1: Replace terrain expectations with constellation-controller tests**

Update the test harness to inspect the field group. Add these focused tests before changing the scene:

```ts
it("builds the dense constellation instead of wireframe planes", () => {
  const { controller, renderer } = createHarness();
  controller.renderStatic();
  const scene = renderedScene(renderer);
  const field = scene.children.find((child) => child instanceof THREE.Group) as THREE.Group;
  expect(field.children[0]).toBeInstanceOf(THREE.Points);
  expect((field.children[1] as THREE.Mesh).geometry).toBeInstanceOf(
    THREE.InstancedBufferGeometry,
  );
  expect(field.children[2]).toBeInstanceOf(THREE.LineSegments);
});

it("normalizes pointer speed by time and canvas size", () => {
  const rect = { width: 1_000, height: 500 } as DOMRect;
  expect(normalizePointerSpeed(100, 0, 16, rect)).toBeCloseTo(1);
  expect(normalizePointerSpeed(0, 0, 0, rect)).toBe(0);
  expect(normalizePointerSpeed(10_000, 0, 16, rect)).toBe(1);
});

it("passes damped pointer position and speed into the field", () => {
  const { callbacks, controller, renderer } = createHarness();
  controller.setPointer(1, -1, 0.8);
  controller.start();
  callbacks.get(1)?.(1_000);
  const field = renderedScene(renderer).children.find((child) => child instanceof THREE.Group) as THREE.Group;
  const uniforms = (field.children[0].material as THREE.ShaderMaterial).uniforms;
  expect(uniforms.uPointer.value.x).toBeGreaterThan(0);
  expect(uniforms.uPointerSpeed.value).toBeGreaterThan(0);
  expect(uniforms.uPointerSpeed.value).toBeLessThan(0.8);
});
```

- [ ] **Step 2: Run the background-scene test and confirm terrain assertions or missing APIs fail**

Run: `npm test -- src/three/backgroundScene.test.ts`

Expected: FAIL on the constellation structure and `normalizePointerSpeed` export.

- [ ] **Step 3: Replace the terrain with `createParticleField`**

Change `SceneTheme` and the controller signature:

```ts
export type SceneTheme = ParticlePalette & {
  background: THREE.ColorRepresentation;
  blendMode: ParticleBlendMode;
};

export type BackgroundController = {
  start(): void;
  stop(): void;
  resize(width: number, height: number, pixelRatio: number): void;
  setPointer(x: number, y: number, speed: number): void;
  setTheme(theme: SceneTheme): void;
  renderStatic(): void;
  dispose(): void;
};

export function normalizePointerSpeed(
  deltaX: number,
  deltaY: number,
  deltaMs: number,
  rect: DOMRect,
): number {
  if (deltaMs <= 0 || rect.width <= 0 || rect.height <= 0) return 0;
  const normalizedDistance = Math.hypot(deltaX / rect.width, deltaY / rect.height);
  return Math.min(normalizedDistance / (deltaMs / 1_000), 1);
}
```

Remove the plane geometry, terrain materials, layers, camera parallax, and imports from `shaders.ts`. Create one particle field, add its group to the scene, and route `setTime`, `setPointer`, `setContentMask`, `setColors`, `setBlendMode`, and disposal through its controller. Convert the damped normalized pointer to field coordinates with `pointer.x * 900` and `pointer.y * 520` before calling `field.setPointer`.

Use this state in place of the terrain arrays:

```ts
  const field = createParticleField("high");
  scene.add(field.group);
  const pointer = new THREE.Vector2();
  const pointerTarget = new THREE.Vector2();
  let pointerSpeed = 0;
  let pointerSpeedTarget = 0;
  const particleColor = new THREE.Color("#aeb4ba");
  const particleTarget = particleColor.clone();
  const signalColor = new THREE.Color("#f4f6f7");
  const signalTarget = signalColor.clone();
  const connectionColor = new THREE.Color("#697078");
  const connectionTarget = connectionColor.clone();
  const clearColor = new THREE.Color("#222222");
  const clearTarget = clearColor.clone();

  const applyTargets = (amount: number): void => {
    pointer.lerp(pointerTarget, amount);
    pointerSpeed += (pointerSpeedTarget - pointerSpeed) * amount;
    particleColor.lerp(particleTarget, amount);
    signalColor.lerp(signalTarget, amount);
    connectionColor.lerp(connectionTarget, amount);
    clearColor.lerp(clearTarget, amount);
    field.setPointer(pointer.x * 900, pointer.y * 520, pointerSpeed);
    field.setColors({
      particle: particleColor,
      signal: signalColor,
      connection: connectionColor,
    });
    renderer.setClearColor(clearColor, 1);
  };
```

Before calling `applyTargets` for an animated frame, decay `pointerSpeedTarget` with `pointerSpeedTarget *= Math.exp(-deltaSeconds * 3.2)`. This removes pointer influence after inactivity while the field continues its autonomous cluster motion.

Keep the camera at `(0, 0, 1_050)`. On resize, derive a normalized content mask centered at `(0.5, 0.5)` with half-width `min(0.28, 300 / width)` and half-height `min(0.42, 420 / height)`.

- [ ] **Step 4: Add theme interpolation and static-frame behavior**

Store current and target `THREE.Color` values for particle, signal, connection, and clear colors. Interpolate all four in `applyTargets(amount)`, then pass the current three field colors to `field.setColors`. Call `field.setBlendMode(theme.blendMode)` when `setTheme` receives a new theme. Dark mode uses additive blending; light mode uses normal alpha blending so gray particles can darken the white background.

Implement the public updates and static renderer with:

```ts
    setPointer(x: number, y: number, speed: number): void {
      pointerTarget.set(x, y);
      pointerSpeedTarget = Math.min(Math.max(speed, 0), 1);
    },
    setTheme(theme: SceneTheme): void {
      particleTarget.set(theme.particle);
      signalTarget.set(theme.signal);
      connectionTarget.set(theme.connection);
      clearTarget.set(theme.background);
      field.setBlendMode(theme.blendMode);
    },
    renderStatic(): void {
      if (disposed) return;
      pointer.set(0, 0);
      pointerTarget.set(0, 0);
      pointerSpeed = 0;
      pointerSpeedTarget = 0;
      try {
        applyTargets(1);
        field.setTime(18);
        renderer.render(scene, camera);
      } catch (error) {
        reportFailure(error);
      }
    },
```

`renderStatic()` must set pointer position and speed to zero, render at time `18`, and schedule no frame. Preserve the existing failure callback, shader preflight, visibility pause, elapsed-time accounting, and one-time disposal tests.

- [ ] **Step 5: Add failing adaptive-quality tests**

Inject `hardwareConcurrency?: number` through `BackgroundSceneOptions` so tests remain deterministic. Add a test that resizes to high quality, feeds 30 warmup frames and 90 sampled frames at 25 ms, then advances 16 more 25 ms frames for the quality fade. Assert that ambient draw range falls to 6,000. Add a second test that feeds 120 frames at 16 ms and keeps the high range at 10,000.

```ts
function advanceFrames(
  callbacks: Map<number, FrameRequestCallback>,
  count: number,
  deltaMs: number,
): void {
  for (let frame = 1; frame <= count; frame += 1) {
    callbacks.get(frame)?.(1_000 + (frame - 1) * deltaMs);
  }
}

function ambientDrawCount(renderer: ReturnType<typeof createSceneSetup>["renderer"]): number {
  const scene = renderedScene(renderer);
  const field = scene.children.find((child) => child instanceof THREE.Group) as THREE.Group;
  return ((field.children[0] as THREE.Points).geometry as THREE.BufferGeometry).drawRange.count;
}

it("fades from high to medium after a sustained slow-frame window", () => {
  const setup = createSceneSetup();
  const controller = createBackgroundScene(setup.canvas, {
    ...setup.dependencies,
    hardwareConcurrency: 12,
  });
  controller.resize(1_440, 900, 1.5);
  controller.start();
  advanceFrames(setup.callbacks, 136, 25);
  expect(ambientDrawCount(setup.renderer)).toBe(6_000);
});

it("keeps high quality during a sustained 60 fps sample", () => {
  const setup = createSceneSetup();
  const controller = createBackgroundScene(setup.canvas, {
    ...setup.dependencies,
    hardwareConcurrency: 12,
  });
  controller.resize(1_440, 900, 1.5);
  controller.start();
  advanceFrames(setup.callbacks, 140, 16);
  expect(ambientDrawCount(setup.renderer)).toBe(10_000);
});
```

Use this frame-budget rule in the implementation:

```ts
const SAMPLE_FRAMES = 90;
const SLOW_FRAME_MS = 22;
const REQUIRED_SLOW_FRAMES = 45;
const QUALITY_FADE_SECONDS = 0.4;
```

Ignore the first 30 animated frames. Count slow frames in the next 90. If 45 or more frames exceed 22 ms, lower one tier, animate `uQualityMix` to the lower tier value over 0.4 seconds, apply the new draw ranges, and stop quality sampling for the page session.

Map quality tiers to shader mix values with `const QUALITY_MIX = { low: 0, medium: 1, high: 2 } as const`. On resize, choose the initial tier, apply its draw ranges, and set its mix value without a transition. During a runtime downgrade, lower the mix first and apply the smaller draw ranges after the 0.4-second fade.

Use one transition record and these update functions inside the existing animation loop:

```ts
  const QUALITY_MIX = { low: 0, medium: 1, high: 2 } as const;
  let qualityTier: QualityTier = "high";
  let qualityInitialized = false;
  let warmupFrames = 0;
  let sampleFrames = 0;
  let slowFrames = 0;
  let performanceLocked = false;
  let qualityTransition: { from: number; to: QualityTier; elapsed: number } | null = null;

  const beginQualityTransition = (to: QualityTier): void => {
    if (to === qualityTier || qualityTransition) return;
    qualityTransition = { from: QUALITY_MIX[qualityTier], to, elapsed: 0 };
  };

  const samplePerformance = (deltaMs: number): void => {
    if (!qualityInitialized || performanceLocked || qualityTransition) return;
    if (warmupFrames < 30) { warmupFrames += 1; return; }
    sampleFrames += 1;
    if (deltaMs > SLOW_FRAME_MS) slowFrames += 1;
    if (sampleFrames < SAMPLE_FRAMES) return;
    if (slowFrames >= REQUIRED_SLOW_FRAMES && qualityTier !== "low") {
      performanceLocked = true;
      beginQualityTransition(lowerQuality(qualityTier));
    }
    sampleFrames = 0;
    slowFrames = 0;
  };

  const updateQualityTransition = (deltaSeconds: number): void => {
    if (!qualityTransition) return;
    qualityTransition.elapsed += deltaSeconds;
    const progress = Math.min(qualityTransition.elapsed / QUALITY_FADE_SECONDS, 1);
    const targetMix = QUALITY_MIX[qualityTransition.to];
    field.setQualityMix(THREE.MathUtils.lerp(qualityTransition.from, targetMix, progress));
    if (progress < 1) return;
    qualityTier = qualityTransition.to;
    field.setQuality(qualityTier);
    qualityTransition = null;
  };
```

Call `samplePerformance(deltaMs)` and `updateQualityTransition(deltaMs * 0.001)` after computing each visible frame delta. In `resize`, call `selectQualityTier` with the safe dimensions, capped pixel ratio, and injected core count. Apply the selected profile and mix on the first resize. Later resize events may start a transition to a lower selected tier; they must not raise `qualityTier` after a performance downgrade.

- [ ] **Step 6: Delete the terrain shaders and run the Three.js tests**

Delete `src/three/shaders.ts` after no source or test imports it.

Run: `npm test -- src/three/particleField.test.ts src/three/particleShaders.test.ts src/three/backgroundScene.test.ts && npm run typecheck`

Expected: PASS with no import of `src/three/shaders.ts` and no TypeScript errors.

- [ ] **Step 7: Commit the scene replacement**

```bash
git add src/three/backgroundScene.ts src/three/backgroundScene.test.ts src/three/shaders.ts
git commit -m "feat: replace terrain with constellation scene"
```

---

### Task 5: React Pointer Integration, Theme Presentation, and Full Verification

**Files:**
- Modify: `src/components/BackgroundCanvas.tsx:11-145`
- Modify: `src/components/BackgroundCanvas.test.tsx:1-258`
- Modify: `src/styles/canvas.module.scss:1-15`

**Interfaces:**
- Consumes: `BackgroundController.setPointer(x, y, speed)`, `normalizePointer`, `normalizePointerSpeed`, and expanded `SceneTheme` from Task 4.
- Produces: pointer position and velocity events, approved monochrome theme values, and tuned compositing opacity.

- [ ] **Step 1: Add failing palette and pointer-speed integration tests**

Replace the existing palette assertion and pointer test with:

```ts
it("maps dark and white themes to the constellation palette", () => {
  const { rerender } = render(<BackgroundCanvas theme="dark" />);
  expect(controller.setTheme).toHaveBeenLastCalledWith({
    background: "#222222",
    blendMode: "additive",
    particle: "#aeb4ba",
    signal: "#f4f6f7",
    connection: "#697078",
  });

  rerender(<BackgroundCanvas theme="white" />);
  expect(controller.setTheme).toHaveBeenLastCalledWith({
    background: "#ffffff",
    blendMode: "normal",
    particle: "#7d848a",
    signal: "#272b2e",
    connection: "#a2a7ac",
  });
});

it("passes normalized pointer position and capped speed", () => {
  render(<BackgroundCanvas theme="dark" />);
  const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 1_000, height: 500,
  } as DOMRect);

  act(() => window.dispatchEvent(new PointerEvent("pointermove", {
    clientX: 100, clientY: 100,
  })));
  act(() => window.dispatchEvent(new PointerEvent("pointermove", {
    clientX: 200, clientY: 100,
  })));

  const [x, y, speed] = vi.mocked(controller.setPointer).mock.calls.at(-1) ?? [];
  expect(x).toBeCloseTo(-0.6);
  expect(y).toBeCloseTo(0.6);
  expect(speed).toBeGreaterThanOrEqual(0);
  expect(speed).toBeLessThanOrEqual(1);
});
```

Keep the reduced-motion test and assert `controller.setPointer` receives no call for reduced-motion users.

- [ ] **Step 2: Run the component test and confirm interface failures**

Run: `npm test -- src/components/BackgroundCanvas.test.tsx`

Expected: FAIL because the component still supplies the terrain palette and omits pointer speed.

- [ ] **Step 3: Update theme values and pointer tracking**

Use these values:

```ts
const sceneThemes: Record<Theme, SceneTheme> = {
  dark: {
    background: "#222222",
    blendMode: "additive",
    particle: "#aeb4ba",
    signal: "#f4f6f7",
    connection: "#697078",
  },
  white: {
    background: "#ffffff",
    blendMode: "normal",
    particle: "#7d848a",
    signal: "#272b2e",
    connection: "#a2a7ac",
  },
};

const canvasOpacities: Record<Theme, string> = {
  dark: "0.58",
  white: "0.38",
};
```

Track the previous pointer sample in the effect closure:

```ts
let previousPointer: { x: number; y: number; time: number } | null = null;

const onPointerMove = (event: PointerEvent): void => {
  if (closed || reducedMotion || !controller) return;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const pointer = normalizePointer(event.clientX, event.clientY, rect);
  const speed = previousPointer
    ? normalizePointerSpeed(
        event.clientX - previousPointer.x,
        event.clientY - previousPointer.y,
        event.timeStamp - previousPointer.time,
        rect,
      )
    : 0;
  previousPointer = { x: event.clientX, y: event.clientY, time: event.timeStamp };
  controller.setPointer(pointer.x, pointer.y, speed);
};
```

Reset `previousPointer` when the document becomes hidden and during teardown.

- [ ] **Step 4: Tune the canvas compositing rule**

Keep the fixed, decorative canvas behavior. Add `contain: strict` and retain the CSS-controlled background and opacity:

```scss
.canvas {
  background: var(--canvas-background);
  contain: strict;
  display: block;
  height: 100%;
  inset: 0;
  opacity: var(--canvas-opacity);
  pointer-events: none;
  position: fixed;
  width: 100%;
  z-index: -1;
}
```

- [ ] **Step 5: Run focused component and scene tests**

Run: `npm test -- src/components/BackgroundCanvas.test.tsx src/three/backgroundScene.test.ts`

Expected: PASS with palette, pointer-speed, reduced-motion, visibility, resize, failure, and cleanup tests green.

- [ ] **Step 6: Run the full project verification**

Run: `npm run verify`

Expected: all Vitest tests pass, TypeScript reports no errors, Vite builds `dist`, and the SPA fallback script creates `dist/404.html`.

- [ ] **Step 7: Perform the visual acceptance pass**

Run: `npm run dev -- --host 127.0.0.1`

Check these cases in the browser:

- Dark and light themes at 1440x900 show dense clusters, signal halos, links, and short trails without obscuring the 600px content column.
- Cursor motion bends the nearby field and raises signal energy; stopping the cursor returns the scene to autonomous drift.
- A 390x844 viewport uses the low tier and remains responsive while scrolling.
- Reduced motion shows one stable constellation and ignores pointer movement.
- Navigating between Home, Work, a project detail page, and Contact leaves the canvas stable and readable.

Expected: each case matches the approved design and the browser console shows no shader, WebGL, or disposal error.

- [ ] **Step 8: Commit the React integration and final tuning**

```bash
git add src/components/BackgroundCanvas.tsx src/components/BackgroundCanvas.test.tsx src/styles/canvas.module.scss
git commit -m "feat: integrate constellation background"
```
