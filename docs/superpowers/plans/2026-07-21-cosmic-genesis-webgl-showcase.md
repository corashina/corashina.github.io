# Cosmic Genesis WebGL Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone full-screen Cosmic Genesis scene at `/showcase/` that combines GPU particles, an animated Marching Cubes star, physical transmission, a GPGPU membrane, volumetric raymarching, PCSS shadows, GTAO, SSR, and selective bloom.

**Architecture:** A self-contained Vite and TypeScript application lives under `showcase/` and imports no portfolio runtime code. `ShowcaseApp` coordinates focused rendering systems through shared frame, interaction, and quality interfaces; each system owns and disposes its GPU resources. Unit tests cover deterministic logic and lifecycle contracts, while Playwright verifies shader compilation, WebGL behavior, input, fallbacks, and production routing.

**Tech Stack:** Three.js 0.185.1, TypeScript 7.0.2, Vite 8.1.5, Vitest 4.1.10, jsdom 29.1.1, Playwright 1.61.1, GLSL ES 3.0, WebGL 2

## Global Constraints

- Keep all tracked implementation changes under `showcase/`; do not modify the portfolio runtime or its dirty root files.
- Serve the application from Vite base path `/showcase/`.
- Require WebGL 2 and show the committed fallback image when capability checks, shader compilation, allocation, or repeated context restoration fail.
- Pin dependency versions exactly in `showcase/package.json` and commit `showcase/package-lock.json`.
- Use no React runtime and no third-party rendering package beyond Three.js addons.
- Keep simulation work on the GPU and avoid per-frame GPU-to-CPU readback.
- Cap elapsed frame time and fixed simulation steps.
- Support Auto, Ultra, High, Medium, and Low quality modes.
- Preserve the approved tier values for particle count, membrane resolution, Marching Cubes resolution, volumetric steps, pixel ratio, SSR, GTAO, and shadows.
- Target 60 frames per second on modern desktops and at least 30 frames per second on capable mobile devices after shader warm-up.
- Support pointer gravity, camera drag, wheel and pinch zoom, tap or click pulse, arrow-key orbit, `+` and `-` zoom, `Space` pulse, and `R` reset.
- Respect `prefers-reduced-motion` by removing camera inertia, rapid particle ejection, and high-frequency surface deformation.
- Pause clocks and rendering while the document is hidden.
- Make every public `dispose()` method safe to call more than once.
- Exclude audio, WebXR, path tracing, imported 3D models, backend services, analytics, and portfolio navigation changes.

## File Map

- Create `showcase/package.json` and `showcase/package-lock.json`: exact dependencies and isolated scripts.
- Create `showcase/tsconfig.json`, `showcase/vite.config.ts`, and `showcase/playwright.config.ts`: compiler, unit-test, build, and browser-test configuration.
- Create `showcase/index.html`, `showcase/src/main.ts`, and `showcase/src/styles.css`: full-screen shell, overlay, compatibility state, and startup.
- Create `showcase/public/fallback.svg`: temporary code-native fallback used until Task 10 captures the final image.
- Create `showcase/src/app/contracts.ts`: shared frame, interaction, quality, and scene-system interfaces.
- Create `showcase/src/app/capabilities.ts`: WebGL 2 and reduced-motion probes.
- Create `showcase/src/app/ShowcaseApp.ts`: scene construction, fixed-step loop, subsystem wiring, visibility, resize, context recovery, and cleanup.
- Create `showcase/src/interaction/interactionMath.ts`, `showcase/src/interaction/InteractionController.ts`, and `showcase/src/interaction/CameraController.ts`: pointer projection, drag, zoom, keyboard, pulse, camera inertia, and energy state.
- Create `showcase/src/quality/qualityProfiles.ts` and `showcase/src/quality/QualityManager.ts`: exact tier settings, device selection, frame sampling, hysteresis, manual override, and transitions.
- Create `showcase/src/runtime/FixedStepClock.ts`: bounded deterministic simulation stepping.
- Create `showcase/src/particles/particleSeeds.ts`, `showcase/src/particles/particleShaders.ts`, and `showcase/src/particles/ParticleSimulation.ts`: GPGPU particle compute and rendering.
- Create `showcase/src/core/coreField.ts`, `showcase/src/core/protoStarMaterial.ts`, and `showcase/src/core/ProtoStar.ts`: metaball field, Marching Cubes mesh, and plasma-to-crystal physical material.
- Create `showcase/src/membrane/membraneShaders.ts` and `showcase/src/membrane/SpaceMembrane.ts`: GPGPU height simulation and reflective surface.
- Create `showcase/src/volume/noiseVolume.ts`, `showcase/src/volume/nebulaShader.ts`, and `showcase/src/volume/NebulaPass.ts`: deterministic density data and depth-aware raymarching.
- Create `showcase/src/rendering/AuxiliaryBufferPass.ts`, `showcase/src/rendering/MaskedBloomPass.ts`, `showcase/src/rendering/pcss.ts`, and `showcase/src/rendering/RenderPipeline.ts`: MRT normals and energy, GTAO, selective SSR, bloom, PCSS, grading, and resource ownership.
- Create colocated `*.test.ts` files for pure logic, shader contracts, resource ownership, quality, interaction, and orchestration.
- Create `showcase/e2e/showcase.spec.ts`: browser smoke, input, reduced motion, context loss, and route checks.
- Create `showcase/scripts/capture-fallback.mjs`: production fallback capture.
- Create `showcase/public/fallback.png`: captured fallback composition.
- Create `showcase/README.md`: development, verification, capture, and portfolio deployment commands.

---

### Task 1: Isolated Application Shell and Capability Fallback

**Files:**
- Create: `showcase/package.json`
- Create: `showcase/package-lock.json`
- Create: `showcase/tsconfig.json`
- Create: `showcase/vite.config.ts`
- Create: `showcase/index.html`
- Create: `showcase/src/main.ts`
- Create: `showcase/src/styles.css`
- Create: `showcase/public/fallback.svg`
- Create: `showcase/src/app/capabilities.ts`
- Test: `showcase/src/app/capabilities.test.ts`

**Interfaces:**
- Produces: `CapabilityReport`, `detectCapabilities(canvas, matchMedia)`, a canvas with id `showcase-canvas`, and DOM states `loading`, `ready`, or `fallback`.
- Consumes: no earlier task.

- [ ] **Step 1: Create the isolated package and tool configuration**

Use exact versions and scripts:

```json
{
  "name": "cosmic-genesis-showcase",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.15.0", "npm": ">=11.12.0" },
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:browser": "playwright test",
    "build": "npm run typecheck && vite build",
    "build:portfolio": "npm run typecheck && vite build --outDir ../public/showcase --emptyOutDir",
    "preview": "vite preview",
    "capture:fallback": "node scripts/capture-fallback.mjs",
    "verify": "npm run test && npm run build && npm run test:browser"
  },
  "dependencies": { "three": "0.185.1" },
  "devDependencies": {
    "@playwright/test": "1.61.1",
    "@types/three": "0.185.1",
    "jsdom": "29.1.1",
    "typescript": "7.0.2",
    "vite": "8.1.5",
    "vitest": "4.1.10"
  }
}
```

Configure Vite with `base: "/showcase/"`, `environment: "jsdom"` for Vitest, and `assetsInlineLimit: 0`. Configure TypeScript with `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, DOM libraries, and `moduleResolution: "Bundler"`.

- [ ] **Step 2: Install the isolated dependencies**

Run: `npm --prefix showcase install`

Expected: npm creates `showcase/package-lock.json` with no change to the root lockfile.

- [ ] **Step 3: Write the failing capability tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { detectCapabilities } from "./capabilities";

describe("detectCapabilities", () => {
  it("reports WebGL 2 and reduced motion", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue({} as WebGL2RenderingContext);
    const report = detectCapabilities(canvas, () => ({ matches: true }) as MediaQueryList);
    expect(report).toEqual({ webgl2: true, reducedMotion: true });
  });

  it("rejects a canvas without WebGL 2", () => {
    const canvas = document.createElement("canvas");
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    expect(detectCapabilities(canvas, () => ({ matches: false }) as MediaQueryList).webgl2).toBe(false);
  });
});
```

- [ ] **Step 4: Run the focused test and confirm the missing-module failure**

Run: `npm --prefix showcase test -- src/app/capabilities.test.ts`

Expected: FAIL because `./capabilities` does not exist.

- [ ] **Step 5: Implement capability detection and the DOM shell**

```ts
export type CapabilityReport = { webgl2: boolean; reducedMotion: boolean };

export function detectCapabilities(
  canvas: HTMLCanvasElement,
  media: typeof window.matchMedia,
): CapabilityReport {
  return {
    webgl2: canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) !== null,
    reducedMotion: media("(prefers-reduced-motion: reduce)").matches,
  };
}
```

Create `index.html` with `#showcase-root`, `#showcase-canvas`, a fallback `<picture>` using `/showcase/fallback.svg`, an interaction hint, quality `<select>`, and reset button. Create `fallback.svg` as a near-black radial gradient with cyan, violet, and gold circles so capability fallback remains usable during development. `main.ts` must set `document.documentElement.dataset.showcaseState` to `fallback` when WebGL 2 fails and to `loading` before later app startup. CSS must make the canvas and fallback fill the viewport, keep controls above the canvas, and hide unavailable states through the root data attribute.

- [ ] **Step 6: Run capability tests, type checking, and the first build**

Run: `npm --prefix showcase test -- src/app/capabilities.test.ts && npm --prefix showcase run build`

Expected: capability tests pass and Vite writes `showcase/dist/index.html` with `/showcase/` asset URLs.

- [ ] **Step 7: Commit the isolated shell**

```bash
git add showcase/package.json showcase/package-lock.json showcase/tsconfig.json showcase/vite.config.ts showcase/index.html showcase/public/fallback.svg showcase/src/main.ts showcase/src/styles.css showcase/src/app/capabilities.ts showcase/src/app/capabilities.test.ts
git commit -m "feat: scaffold cosmic genesis showcase"
```

---

### Task 2: Interaction, Camera Intent, and Pulse Energy

**Files:**
- Create: `showcase/src/app/contracts.ts`
- Create: `showcase/src/interaction/interactionMath.ts`
- Create: `showcase/src/interaction/InteractionController.ts`
- Create: `showcase/src/interaction/CameraController.ts`
- Test: `showcase/src/interaction/interactionMath.test.ts`
- Test: `showcase/src/interaction/InteractionController.test.ts`
- Test: `showcase/src/interaction/CameraController.test.ts`

**Interfaces:**
- Produces: `InteractionSnapshot`, `FrameContext`, `SceneSystem`, `normalizePointer`, `classifyGesture`, `accumulateEnergy`, `InteractionController.sample(deltaSeconds)`, `CameraController.update(frame)`, and `CameraController.projectPointer(pointerNdc)`.
- Consumes: the canvas and DOM shell from Task 1.

- [ ] **Step 1: Write failing tests for pointer, gesture, and energy math**

```ts
import { describe, expect, it } from "vitest";
import { accumulateEnergy, classifyGesture, normalizePointer } from "./interactionMath";

describe("interaction math", () => {
  it("normalizes pointer coordinates into clip space", () => {
    expect(normalizePointer(750, 125, { left: 250, top: 25, width: 1000, height: 500 })).toEqual([0, 0.6]);
  });

  it("separates a click from a drag at six CSS pixels", () => {
    expect(classifyGesture([10, 10], [15, 12])).toBe("pulse");
    expect(classifyGesture([10, 10], [17, 10])).toBe("drag");
  });

  it("caps energy and requests a release at the ceiling", () => {
    expect(accumulateEnergy(0.8, 0.3)).toEqual({ energy: 1, release: true });
    expect(accumulateEnergy(0.2, 0.3)).toEqual({ energy: 0.5, release: false });
  });
});
```

- [ ] **Step 2: Run the test and confirm missing exports**

Run: `npm --prefix showcase test -- src/interaction/interactionMath.test.ts`

Expected: FAIL because the interaction modules do not exist.

- [ ] **Step 3: Define shared contracts and pure interaction functions**

```ts
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];

export type InteractionSnapshot = {
  pointerNdc: Vec2;
  pointerWorld: Vec3;
  pointerVelocity: Vec2;
  gravity: number;
  orbitDelta: Vec2;
  zoomDelta: number;
  pulseId: number;
  pulseEnergy: number;
  release: boolean;
  resetRequested: boolean;
  reducedMotion: boolean;
};

export type FrameContext = {
  deltaSeconds: number;
  elapsedSeconds: number;
  interaction: InteractionSnapshot;
};

export interface SceneSystem {
  update(frame: FrameContext): void;
  dispose(): void;
}

export interface QualityAwareSystem extends SceneSystem {
  setQuality(profile: import("../quality/qualityProfiles").QualityProfile): void;
}
```

Implement `normalizePointer` with canvas bounds, `classifyGesture` with a six-pixel threshold, and `accumulateEnergy` with a `[0, 1]` clamp and `release` at `1`.

- [ ] **Step 4: Write controller lifecycle tests**

Create tests that dispatch pointer movement, pointer drag, wheel, `Space`, `R`, arrow keys, and touch-compatible pointer events. Assert that `sample(1 / 60)` damps pointer velocity, returns a new `pulseId` for `Space` or a short click, suppresses pulse after drag, reports reset once, and that two `dispose()` calls remove listeners without throwing. Add camera tests that clamp radius to `[5.5, 13]`, clamp polar angle to `[0.45, 1.35]`, remove inertia under reduced motion, restore the approved initial view, and project NDC input onto the orbital plane through a `THREE.Raycaster`.

- [ ] **Step 5: Implement `InteractionController`**

The constructor accepts `{ canvas, eventTarget, reducedMotion }`. Store event data in private mutable fields. `sample(deltaSeconds)` must apply exponential damping, consume one-shot orbit, zoom, release, and reset values, and return an immutable snapshot with `pointerWorld: [0, 0, 0]`; `ShowcaseApp` replaces that value after camera projection. Use `Math.exp(-deltaSeconds * 8)` for pointer velocity damping and `Math.exp(-deltaSeconds * 10)` for camera intent. Cap wheel input to `[-1, 1]`, pointer gravity to `[0, 1]`, and pulse energy to `[0, 1]`.

`CameraController` accepts the camera and approved bounds. It applies orbit and zoom intent, damps angular velocity, handles reset, calls `camera.lookAt(0, 0.4, 0)`, and projects pointer NDC onto a plane through the core whose normal faces the camera.

- [ ] **Step 6: Run interaction tests and type checking**

Run: `npm --prefix showcase test -- src/interaction && npm --prefix showcase run typecheck`

Expected: all interaction tests pass with no TypeScript errors.

- [ ] **Step 7: Commit interaction support**

```bash
git add showcase/src/app/contracts.ts showcase/src/interaction
git commit -m "feat: add direct showcase interaction"
```

---

### Task 3: Quality Profiles, Adaptive Sampling, and Fixed Steps

**Files:**
- Create: `showcase/src/quality/qualityProfiles.ts`
- Create: `showcase/src/quality/QualityManager.ts`
- Create: `showcase/src/runtime/FixedStepClock.ts`
- Test: `showcase/src/quality/qualityProfiles.test.ts`
- Test: `showcase/src/quality/QualityManager.test.ts`
- Test: `showcase/src/runtime/FixedStepClock.test.ts`

**Interfaces:**
- Produces: `QualityTier`, `QualityMode`, `QualityProfile`, `QUALITY_PROFILES`, `selectInitialTier`, `QualityManager`, and `FixedStepClock`.
- Consumes: `CapabilityReport` from Task 1.

- [ ] **Step 1: Write failing tests for all approved tier values**

```ts
expect(QUALITY_PROFILES.ultra).toMatchObject({ particles: 384, membrane: 256, marchingCubes: 56, volumeSteps: 96, pixelRatio: 2, ssrScale: 0.5, gtao: "high", shadows: "pcss-high" });
expect(QUALITY_PROFILES.high).toMatchObject({ particles: 256, membrane: 192, marchingCubes: 48, volumeSteps: 72, pixelRatio: 1.5, ssrScale: 0.5, gtao: "medium", shadows: "pcss-medium" });
expect(QUALITY_PROFILES.medium).toMatchObject({ particles: 192, membrane: 128, marchingCubes: 40, volumeSteps: 48, pixelRatio: 1.25, ssrScale: 0.25, gtao: "low", shadows: "pcf" });
expect(QUALITY_PROFILES.low).toMatchObject({ particles: 128, membrane: 96, marchingCubes: 32, volumeSteps: 28, pixelRatio: 1, ssrScale: 0, gtao: "depth", shadows: "pcf" });
```

Add selection cases for desktop, mobile, reduced motion, four CPU cores, and high pixel count.

- [ ] **Step 2: Run the quality test and confirm the missing-module failure**

Run: `npm --prefix showcase test -- src/quality/qualityProfiles.test.ts`

Expected: FAIL because `qualityProfiles.ts` does not exist.

- [ ] **Step 3: Implement exact profiles and initial selection**

```ts
export type QualityTier = "low" | "medium" | "high" | "ultra";
export type QualityMode = "auto" | QualityTier;
export type GtaoLevel = "depth" | "low" | "medium" | "high";
export type ShadowLevel = "pcf" | "pcss-medium" | "pcss-high";

export type QualityProfile = {
  particles: 128 | 192 | 256 | 384;
  membrane: 96 | 128 | 192 | 256;
  marchingCubes: 32 | 40 | 48 | 56;
  volumeSteps: 28 | 48 | 72 | 96;
  pixelRatio: 1 | 1.25 | 1.5 | 2;
  ssrScale: 0 | 0.25 | 0.5;
  gtao: GtaoLevel;
  shadows: ShadowLevel;
};
```

`selectInitialTier` accepts viewport pixels, device pixel ratio, hardware concurrency, device memory, touch capability, and reduced motion. Reduced motion must cap the result at Medium. Four or fewer cores must select Low.

- [ ] **Step 4: Write adaptive-manager and fixed-clock tests**

Test a 180-frame warm-up, a rolling 120-frame percentile, downgrade after the 75th-percentile frame exceeds 20 ms, one upgrade after 600 stable frames below 15 ms, a 300-frame cooldown, manual-mode lock, and no tier oscillation. Test `FixedStepClock(1 / 60, 4, 0.1)` for capped delta, a maximum of four steps, pause, resume without catch-up, and reset.

- [ ] **Step 5: Implement `QualityManager` and `FixedStepClock`**

`QualityManager.sample(frameMs, now)` must ignore warm-up frames, store at most 120 values, sort a copy for the percentile, and create `{ from, to, startedAt, duration: 0.45 }` transitions. It returns the newly selected tier or `null`. It must expose `setMode(mode): QualityTier`, `getTier()`, `getProfile()`, `getTransition(now)`, and `sample(frameMs, now): QualityTier | null`. Automatic selection may downgrade more than once after separate cooldowns and may upgrade once per page session.

`FixedStepClock.advance(nowMs, step)` must cap frame delta at `0.1`, run at most four `1 / 60` steps, discard excess accumulated time, and return the interpolation alpha.

- [ ] **Step 6: Run focused tests and type checking**

Run: `npm --prefix showcase test -- src/quality src/runtime && npm --prefix showcase run typecheck`

Expected: profile, hysteresis, manual-mode, and fixed-step tests pass.

- [ ] **Step 7: Commit runtime control logic**

```bash
git add showcase/src/quality showcase/src/runtime
git commit -m "feat: add adaptive showcase quality"
```

---

### Task 4: GPGPU Orbital Particle System

**Files:**
- Create: `showcase/src/particles/particleSeeds.ts`
- Create: `showcase/src/particles/particleShaders.ts`
- Create: `showcase/src/particles/ParticleSimulation.ts`
- Test: `showcase/src/particles/particleSeeds.test.ts`
- Test: `showcase/src/particles/particleShaders.test.ts`
- Test: `showcase/src/particles/ParticleSimulation.test.ts`

**Interfaces:**
- Consumes: `FrameContext` and `QualityProfile` from Tasks 2 and 3.
- Produces: `ParticleSimulation.object`, `update(frame)`, `setQuality(profile)`, `getPositionTexture()`, `getEnergyTexture()`, and `dispose()`.

- [ ] **Step 1: Write deterministic seed tests**

Test `createParticleSeedTexture(128, 0x51a7)` twice and compare its data. Assert that each position lies within radius `8`, each velocity remains below `1`, and every alpha seed lies in `[0, 1]`. Assert that a `384` texture contains `147456` particles.

- [ ] **Step 2: Run the seed test and confirm the missing-module failure**

Run: `npm --prefix showcase test -- src/particles/particleSeeds.test.ts`

Expected: FAIL because the seed module does not exist.

- [ ] **Step 3: Implement seeded position, velocity, and energy textures**

Use a local Mulberry32 generator. Fill RGBA float data with a flattened orbital disk plus vertical jitter. Store seed in alpha. Return `THREE.DataTexture` instances with `FloatType`, `RGBAFormat`, `NearestFilter`, and `needsUpdate = true`.

- [ ] **Step 4: Write shader-contract tests**

Assert that the velocity shader samples `texturePosition` and `textureVelocity`, computes orbital, curl, pointer, and pulse forces, clamps speed, and applies damping. Assert that the position shader integrates velocity with `uDelta`. Assert that the render vertex shader samples the computed position texture and that the fragment shader produces a soft radial point with cyan, violet, and gold energy phases.

- [ ] **Step 5: Implement compute and render shaders**

Use these force bounds in the velocity shader:

```glsl
vec3 radial = position.xyz - uCorePosition;
vec3 orbital = normalize(cross(vec3(0.0, 1.0, 0.0), radial)) * uOrbitStrength;
vec3 pointerDelta = uPointerPosition - position.xyz;
float pointerFalloff = exp(-dot(pointerDelta, pointerDelta) * 0.18);
vec3 pointerForce = normalize(pointerDelta + 1e-5) * pointerFalloff * uPointerGravity;
float pulseFalloff = exp(-abs(length(radial) - uPulseRadius) * 2.5);
vec3 pulseForce = normalize(radial + 1e-5) * pulseFalloff * uPulseEnergy;
velocity.xyz = clampLength((velocity.xyz + (orbital + curl + pointerForce + pulseForce) * uDelta) * exp(-uDelta * 0.18), 5.0);
```

Include a local `clampLength` function and a bounded curl-noise function. The position shader must wrap particles that exceed radius `12` back toward their seeded orbit instead of teleporting them to a shared point.

- [ ] **Step 6: Implement `ParticleSimulation` with an injectable compute factory**

Create two `GPUComputationRenderer` variables named `texturePosition` and `textureVelocity`, set both dependencies, and attach the interaction uniforms. Render particles through one `THREE.Points` object whose geometry contains one UV lookup per texel. `update` must call `compute()` once per fixed step and publish the current position texture to the render material. `setQuality` must allocate a replacement simulation, advance both simulations during a 0.45-second crossfade, and dispose the old simulation after the fade. Tests must use a fake compute factory to verify compute calls, uniform updates, crossfade ownership, and repeated disposal.

- [ ] **Step 7: Run particle tests and type checking**

Run: `npm --prefix showcase test -- src/particles && npm --prefix showcase run typecheck`

Expected: deterministic seed, shader contract, update, transition, and disposal tests pass.

- [ ] **Step 8: Commit the particle system**

```bash
git add showcase/src/particles
git commit -m "feat: add gpgpu orbital particles"
```

---

### Task 5: Marching Cubes Proto-Star and Physical Material

**Files:**
- Create: `showcase/src/core/coreField.ts`
- Create: `showcase/src/core/protoStarMaterial.ts`
- Create: `showcase/src/core/ProtoStar.ts`
- Test: `showcase/src/core/coreField.test.ts`
- Test: `showcase/src/core/protoStarMaterial.test.ts`
- Test: `showcase/src/core/ProtoStar.test.ts`

**Interfaces:**
- Consumes: `FrameContext` and `QualityProfile`.
- Produces: `ProtoStar.object`, `update(frame)`, `setQuality(profile)`, `getShadowMaterials()`, and `dispose()`.

- [ ] **Step 1: Write failing deterministic metaball tests**

Test `sampleMetaballs(elapsed, energy, release)` at fixed times. Assert six sources, repeatable positions, radius bounds `[0.12, 0.42]`, outward expansion as energy rises, and a bounded release displacement.

- [ ] **Step 2: Run the core-field test and confirm failure**

Run: `npm --prefix showcase test -- src/core/coreField.test.ts`

Expected: FAIL because the core field does not exist.

- [ ] **Step 3: Implement metaball sampling and field application**

`sampleMetaballs` must use six phase-offset Lissajous orbits. `applyMetaballs(effect, sources)` must call `reset()`, `addBall(x, y, z, strength, subtract, color)`, and `update()`. Normalize positions into the Marching Cubes `[0, 1]` field and use `strength = 0.72 + energy * 0.24`, `subtract = 12`.

- [ ] **Step 4: Write physical-material tests**

Assert that `createProtoStarMaterial()` returns `MeshPhysicalMaterial` with transmission, thickness, attenuation, IOR, dispersion, clearcoat, emissive color, a stable `customProgramCacheKey`, and shader injection uniforms `uTime`, `uEnergy`, and `uRelease`. Test `setProtoStarMaterialState` at energy `0` and `1` for bounded roughness, transmission, emissive intensity, and dispersion.

- [ ] **Step 5: Implement the plasma-to-crystal material**

Start with `transmission: 0.18`, `thickness: 1.4`, `ior: 1.48`, `dispersion: 0.08`, `clearcoat: 0.65`, `roughness: 0.28`, and warm emissive color `#ffb36a`. Inject object-space noise and Fresnel rim through `onBeforeCompile`; keep Three.js physical lighting and shadow chunks. At energy `1`, interpolate to transmission `0.92`, dispersion `0.68`, roughness `0.08`, and emissive intensity `2.6`.

- [ ] **Step 6: Implement `ProtoStar` and quality replacement**

Construct `MarchingCubes(profile.marchingCubes, material, false, true, 120000)`. Update the scalar field at 60 Hz on Ultra and High, 30 Hz on Medium, and 20 Hz on Low. Rebuild the effect when resolution changes, copy transform and current energy, set both transition materials to `transparent`, crossfade their opacity for 0.45 seconds, restore the surviving material's opaque state, then dispose the old geometry and material. Tag the mesh with energy and roughness render channels. `getShadowMaterials()` returns the active physical materials for Task 8. Tests must verify update cadence, pulse propagation, replacement, render tags, shadow-material access, and repeated disposal.

- [ ] **Step 7: Run core tests and type checking**

Run: `npm --prefix showcase test -- src/core && npm --prefix showcase run typecheck`

Expected: core field, material bounds, cadence, transition, and disposal tests pass.

- [ ] **Step 8: Commit the proto-star**

```bash
git add showcase/src/core
git commit -m "feat: add procedural proto star"
```

---

### Task 6: GPGPU Space Membrane

**Files:**
- Create: `showcase/src/membrane/membraneShaders.ts`
- Create: `showcase/src/membrane/SpaceMembrane.ts`
- Test: `showcase/src/membrane/membraneShaders.test.ts`
- Test: `showcase/src/membrane/SpaceMembrane.test.ts`

**Interfaces:**
- Consumes: `FrameContext`, `QualityProfile`, and `ParticleSimulation.getPositionTexture()`.
- Produces: `SpaceMembrane.object`, `update(frame, particleTexture)`, `setQuality(profile)`, `getShadowMaterials()`, and `dispose()`.

- [ ] **Step 1: Write shader-contract tests**

Assert that the compute shader samples four height neighbors, stores height and velocity, applies damping, processes pulse rings, and samples eight fixed particle texels. Assert that the vertex shader computes displacement and finite-difference normals from the current height texture. Assert that the fragment shader uses Fresnel, physical roughness, environment lighting, and cyan curvature response. The render pipeline adds screen-space reflection in Task 8.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix showcase test -- src/membrane/membraneShaders.test.ts`

Expected: FAIL because membrane shaders do not exist.

- [ ] **Step 3: Implement bounded wave shaders**

Use this update rule:

```glsl
float laplacian = north + south + east + west - 4.0 * center;
velocity += laplacian * uWaveSpeed * uDelta;
velocity *= exp(-uDamping * uDelta);
height = clamp(center + velocity * uDelta + pulse + impacts, -0.65, 0.65);
```

Sample particle texels at fixed UV coordinates stored in a uniform array. Convert sampled world `xz` positions into membrane UVs and add narrow bounded disturbances when particle `y` approaches the membrane plane.

- [ ] **Step 4: Implement `SpaceMembrane` with fake-compute tests**

Build a plane with `profile.membrane - 1` segments per side. Use `GPUComputationRenderer` for one height/velocity variable. `update` must set pulse, particle, time, and delta uniforms before `compute()`. `setQuality` must crossfade a replacement geometry and compute target. Tag the mesh with low-energy, low-roughness render channels and return active materials from `getShadowMaterials()`. Tests must assert one compute call per fixed step, eight particle samples, pulse id de-duplication, texture propagation, quality replacement, render tags, shadow-material access, and repeated disposal.

- [ ] **Step 5: Run membrane tests and type checking**

Run: `npm --prefix showcase test -- src/membrane && npm --prefix showcase run typecheck`

Expected: shader and controller tests pass.

- [ ] **Step 6: Commit the membrane system**

```bash
git add showcase/src/membrane
git commit -m "feat: add simulated space membrane"
```

---

### Task 7: Depth-Aware Volumetric Nebula

**Files:**
- Create: `showcase/src/volume/noiseVolume.ts`
- Create: `showcase/src/volume/nebulaShader.ts`
- Create: `showcase/src/volume/NebulaPass.ts`
- Test: `showcase/src/volume/noiseVolume.test.ts`
- Test: `showcase/src/volume/nebulaShader.test.ts`
- Test: `showcase/src/volume/NebulaPass.test.ts`

**Interfaces:**
- Consumes: `QualityProfile`, scene depth texture, camera matrices, interaction pulse, and elapsed time.
- Produces: deterministic `Data3DTexture`, `NebulaPass`, `setQuality(profile)`, `setDepthTexture(texture)`, `setNormalTexture(texture)`, `setInteraction(snapshot)`, and `dispose()`.

- [ ] **Step 1: Write deterministic 3D-noise tests**

Test `createNoiseVolume(32, 0xc051c)`. Compare two byte arrays, assert length `32768`, ensure the minimum is below `32`, maximum exceeds `220`, and opposite faces match for seamless sampling.

- [ ] **Step 2: Run the noise test and confirm failure**

Run: `npm --prefix showcase test -- src/volume/noiseVolume.test.ts`

Expected: FAIL because `noiseVolume.ts` does not exist.

- [ ] **Step 3: Implement seamless density data**

Generate periodic fractal value noise with four octaves into a `Uint8Array`. Return a `THREE.Data3DTexture` using `RedFormat`, `UnsignedByteType`, `LinearFilter`, and `RepeatWrapping` on all axes.

- [ ] **Step 4: Write raymarch shader and pass tests**

Assert that the fragment shader reconstructs world position from depth, stops at opaque depth, uses the view normal to soften geometry boundaries, jitters the start with blue-noise hash, skips low-density intervals, caps transmittance, and uses `uMaxSteps`. Test that the pass maps Ultra, High, Medium, and Low to `96`, `72`, `48`, and `28` steps and scales its internal target to `0.5`, `0.5`, `0.5`, and `0.35`.

- [ ] **Step 5: Implement `NebulaPass`**

Extend Three.js `Pass` and render a `FullScreenQuad`. Use near-black extinction, cyan and violet scattering, and warm core light. Clear density around the pulse radius with `smoothstep`. `setSize` must allocate at the tier scale. `dispose()` must release the 3D texture, material, quad, and render target once.

- [ ] **Step 6: Run volume tests and type checking**

Run: `npm --prefix showcase test -- src/volume && npm --prefix showcase run typecheck`

Expected: deterministic noise, shader contract, tier mapping, sizing, and disposal tests pass.

- [ ] **Step 7: Commit volumetric rendering**

```bash
git add showcase/src/volume
git commit -m "feat: add raymarched cosmic nebula"
```

---

### Task 8: MRT, Reflections, Ambient Occlusion, Bloom, and Shadows

**Files:**
- Create: `showcase/src/rendering/AuxiliaryBufferPass.ts`
- Create: `showcase/src/rendering/MaskedBloomPass.ts`
- Create: `showcase/src/rendering/pcss.ts`
- Create: `showcase/src/rendering/RenderPipeline.ts`
- Test: `showcase/src/rendering/AuxiliaryBufferPass.test.ts`
- Test: `showcase/src/rendering/pcss.test.ts`
- Test: `showcase/src/rendering/RenderPipeline.test.ts`

**Interfaces:**
- Consumes: renderer, scene, camera, `NebulaPass`, membrane selection, energy-tagged objects, proto-star and membrane shadow materials, and `QualityProfile`.
- Produces: `RenderPipeline.render(frame)`, `resize(width, height, dpr)`, `setQuality(profile)`, and `dispose()`.

- [ ] **Step 1: Write MRT ownership tests**

Assert that `AuxiliaryBufferPass` creates one half-float `WebGLRenderTarget` with `count: 2`, a depth texture, normal attachment at index `0`, and energy attachment at index `1`. Assert that `setSize` clamps dimensions to at least one and that repeated disposal releases the target and material once.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm --prefix showcase test -- src/rendering/AuxiliaryBufferPass.test.ts`

Expected: FAIL because the pass does not exist.

- [ ] **Step 3: Implement the auxiliary pass and energy tagging**

Use GLSL ES 3.0 outputs:

```glsl
layout(location = 0) out vec4 outNormal;
layout(location = 1) out vec4 outEnergy;
void main() {
  outNormal = vec4(normalize(vViewNormal) * 0.5 + 0.5, uRoughness);
  outEnergy = vec4(uEnergyColor * uEnergy, uEnergy);
}
```

During the auxiliary render, set `uEnergy`, `uEnergyColor`, and `uRoughness` from `object.userData.renderChannels` in the object's `onBeforeRender` callback. Restore original materials and callbacks after the pass.

- [ ] **Step 4: Write PCSS and pipeline-configuration tests**

Test that `applyPcss(material, "pcss-high")` injects blocker search, penumbra calculation, and 32 filter taps with a stable program cache key. Medium must use 16 taps; PCF must leave the shader unchanged. Test pipeline profiles: Low omits SSR and uses depth AO, Medium uses quarter-resolution SSR, High and Ultra use half-resolution SSR, and each tier supplies the approved GTAO and shadow setting.

- [ ] **Step 5: Implement PCSS, masked bloom, and the render pipeline**

Port the PCSS shader functions from the official Three.js example with its MIT attribution comment. Apply injection to the proto-star and membrane materials through chained `onBeforeCompile` callbacks.

`MaskedBloomPass` must multiply HDR color by the auxiliary energy texture before its blur chain, use five mip levels, and add the result back with strength `0.9`, radius `0.62`, and threshold `0.7`. Clamp bloom contribution to avoid a white frame.

`RenderPipeline` must own `EffectComposer`, `RenderPass`, `GTAOPass`, `SSRPass` with `selects: [membrane.object]`, `NebulaPass`, `MaskedBloomPass`, and `OutputPass`. Render the auxiliary pass before the composer, then pass its depth and normal attachments into `NebulaPass` and its energy attachment into `MaskedBloomPass`. Configure `AgXToneMapping`, half-float HDR buffers, sRGB output, and selective SSR. Apply PCSS to the supplied shadow materials. The SSR pass composites membrane reflections into the composer output. Rebuild size-dependent targets through one debounced `resize` call and dispose every pass and target once.

- [ ] **Step 6: Run rendering tests and type checking**

Run: `npm --prefix showcase test -- src/rendering && npm --prefix showcase run typecheck`

Expected: MRT, PCSS, quality configuration, resize, pass order, and disposal tests pass.

- [ ] **Step 7: Commit the render pipeline**

```bash
git add showcase/src/rendering
git commit -m "feat: add cinematic render pipeline"
```

---

### Task 9: Scene Orchestration, Lifecycle, Controls, and Fallbacks

**Files:**
- Create: `showcase/src/app/ShowcaseApp.ts`
- Test: `showcase/src/app/ShowcaseApp.test.ts`
- Modify: `showcase/src/main.ts`
- Modify: `showcase/src/styles.css`

**Interfaces:**
- Consumes: every subsystem from Tasks 2 through 8.
- Produces: `ShowcaseApp.start()`, `setQualityMode(mode)`, `resetView()`, `stop()`, and `dispose()`.

- [ ] **Step 1: Write orchestration tests with injected factories**

Use fake systems and renderer dependencies. Test construction order, one update per fixed step, render after updates, visibility pause, resize clamping, quality propagation, reduced-motion flags, reset behavior, one context restoration attempt, fallback after the second loss, error fallback, and repeated disposal. Assert that no frame callback remains after disposal.

- [ ] **Step 2: Run the app test and confirm failure**

Run: `npm --prefix showcase test -- src/app/ShowcaseApp.test.ts`

Expected: FAIL because `ShowcaseApp.ts` does not exist.

- [ ] **Step 3: Implement scene construction and the bounded loop**

Create a perspective camera at `(5.8, 3.2, 8.6)`, a scene with near-black background, warm key light, cyan rim light, and low violet fill. Place the proto-star at `(0, 1.1, 0)`, membrane at `y = -2.2`, and particle system around the origin. Set camera orbit limits to radius `[5.5, 13]` and polar angle `[0.45, 1.35]`.

During each fixed step:

```ts
const sampled = interactionController.sample(stepSeconds);
const interaction = {
  ...sampled,
  pointerWorld: cameraController.projectPointer(sampled.pointerNdc),
};
const frame = { deltaSeconds: stepSeconds, elapsedSeconds, interaction };
particles.update(frame);
protoStar.update(frame);
membrane.update(frame, particles.getPositionTexture());
nebula.setInteraction(interaction, elapsedSeconds);
cameraController.update(frame);
```

After stepping, call `const changedTier = qualityManager.sample(frameMs, nowMs)`. When the result is non-null, get its profile and call `setQuality(profile)` once on particles, proto-star, membrane, nebula, and pipeline. Read `getTransition(nowMs)` for the quality overlay while each GPU system runs its own 0.45-second resource crossfade. Store the most recent `FrameContext` outside the fixed-step callback and pass it to `pipeline.render(frame)`. Pause the clock on `visibilitychange` and resume without catch-up.

- [ ] **Step 4: Implement context recovery and fallback state**

On `webglcontextlost`, call `preventDefault()`, stop the frame loop, and mark the DOM state `recovering`. On the first `webglcontextrestored`, dispose invalid resources and reconstruct all GPU systems. A second context loss or reconstruction error must call `showFallback(message)`, dispose the app, set state `fallback`, reveal `fallback.png`, and keep controls hidden.

- [ ] **Step 5: Wire the DOM controls and startup**

`main.ts` must create `ShowcaseApp` only after capability detection. Connect the quality select to `setQualityMode`, reset button to `resetView`, and state updates to `data-showcase-state`. Set `data-showcase-ready="true"` after the first successful frame for browser tests. Keep the interaction hint visible for six seconds or until the first pointer, keyboard, or touch action.

- [ ] **Step 6: Run app tests and the full unit suite**

Run: `npm --prefix showcase test && npm --prefix showcase run build`

Expected: all unit tests pass, TypeScript reports no errors, and Vite builds the integrated scene.

- [ ] **Step 7: Commit the working interactive scene**

```bash
git add showcase/src/app showcase/src/main.ts showcase/src/styles.css
git commit -m "feat: integrate cosmic genesis scene"
```

---

### Task 10: Browser Verification, Fallback Capture, and Portfolio Output

**Files:**
- Create: `showcase/playwright.config.ts`
- Create: `showcase/e2e/showcase.spec.ts`
- Create: `showcase/scripts/capture-fallback.mjs`
- Create: `showcase/public/fallback.png`
- Create: `showcase/README.md`
- Modify: `showcase/package.json`
- Modify: `showcase/index.html`

**Interfaces:**
- Consumes: the production application from Task 9.
- Produces: automated browser evidence, the committed fallback asset, documented commands, and a build that writes to `public/showcase` on request.

- [ ] **Step 1: Write failing Playwright smoke tests**

```ts
import { expect, test } from "@playwright/test";

test("loads the WebGL showcase at its production base path", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/showcase/");
  await expect(page.locator("html")).toHaveAttribute("data-showcase-ready", "true");
  await expect(page.locator("#showcase-canvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("accepts direct interaction", async ({ page }) => {
  await page.goto("/showcase/?quality=low&test=1");
  const canvas = page.locator("#showcase-canvas");
  await canvas.hover({ position: { x: 300, y: 220 } });
  await canvas.click({ position: { x: 300, y: 220 } });
  await expect(page.locator("html")).toHaveAttribute("data-last-pulse", "1");
});
```

Add tests for manual Low quality, keyboard reset, reduced motion through `page.emulateMedia`, a touch viewport, context loss and one restoration through `WEBGL_lose_context`, fallback after a second loss, and direct navigation to `/showcase/` after a production build.

- [ ] **Step 2: Configure Playwright and run the failing suite**

Configure `webServer.command` as `npm run build && npm run preview -- --host 127.0.0.1 --port 4174`, `baseURL` as `http://127.0.0.1:4174`, Chromium as the required CI project, and Firefox plus WebKit as local projects.

Run: `npm --prefix showcase exec -- playwright install chromium`

Expected: Playwright installs the Chromium revision required by version `1.61.1`.

Run: `npm --prefix showcase run test:browser -- --project=chromium`

Expected: FAIL until the test hooks and production route behavior match the browser assertions.

- [ ] **Step 3: Add test-only observability and make browser tests pass**

When `test=1`, write the current tier to `data-quality-tier`, pulse id to `data-last-pulse`, and renderer readiness to `data-showcase-ready`. Do not expose simulation buffers or enable this instrumentation without the query flag.

Run: `npm --prefix showcase run test:browser -- --project=chromium`

Expected: all Chromium browser tests pass with no console or shader errors.

- [ ] **Step 4: Create and run the fallback capture script**

The script must start the production preview, open `/showcase/?quality=high&capture=1`, wait for `data-showcase-ready="true"`, wait two seconds for composition settling, hide controls, and capture the viewport at `1600 x 1000` into `showcase/public/fallback.png`. It must stop the preview process in `finally`. Replace the temporary `/showcase/fallback.svg` source in `index.html` with `/showcase/fallback.png` after capture.

Run: `npm --prefix showcase run capture:fallback`

Expected: `showcase/public/fallback.png` exists, shows the approved three-quarter composition, and remains below 1.5 MB. If it exceeds the limit, recapture at `1440 x 900`.

- [ ] **Step 5: Document isolated development and deployment**

Document these commands in `showcase/README.md`:

```bash
npm --prefix showcase install
npm --prefix showcase run dev
npm --prefix showcase run verify
npm --prefix showcase run capture:fallback
npm --prefix showcase run build:portfolio
```

State that `build:portfolio` writes generated files to `public/showcase` after the portfolio build and changes no portfolio source file.

- [ ] **Step 6: Run full automated verification**

Run: `npm --prefix showcase run verify`

Expected: all Vitest tests pass, TypeScript succeeds, Vite builds, and Chromium Playwright tests pass.

- [ ] **Step 7: Perform visual and performance acceptance**

Run: `npm --prefix showcase run dev -- --host 127.0.0.1`

Check these cases with the browser performance panel and console:

- Desktop `1440 x 900`, Auto quality: particle accretion, proto-star deformation, crystal pulse, nebula, membrane ripples, reflections, AO, bloom, and soft shadows remain visible; the scene holds about 60 FPS after warm-up.
- Mobile `390 x 844`, Auto quality: the scene selects Medium or Low, touch controls work, and frame rate stays at or above 30 FPS.
- Reduced motion: camera inertia, rapid ejection, and high-frequency deformation stop while pointer, keyboard, zoom, and pulse controls remain usable.
- Manual transitions: Ultra to Low and Low to High preserve camera position, elapsed simulation time, and a continuous composition.
- Hidden tab and return: animation pauses, resumes without a jump, and produces no console error.
- Context loss twice: the first loss reconstructs; the second shows the captured fallback.

Expected: each acceptance criterion passes. Record any tier-value adjustment as a spec change before changing approved budgets.

- [ ] **Step 8: Verify portfolio output without committing generated deployment files**

Run: `npm --prefix showcase run build:portfolio`

Expected: `public/showcase/index.html` exists and references `/showcase/` assets. Remove the generated `public/showcase` directory after inspection if the repository ignores build output; do not commit generated deployment files.

- [ ] **Step 9: Commit browser coverage, fallback, and documentation**

```bash
git add showcase/playwright.config.ts showcase/e2e showcase/scripts showcase/public/fallback.png showcase/README.md showcase/index.html showcase/package.json showcase/package-lock.json
git commit -m "test: verify cosmic genesis showcase"
```

---

## Final Verification

- [ ] Run `npm --prefix showcase run verify` and confirm unit tests, type checking, production build, and Chromium tests pass.
- [ ] Run `npm --prefix showcase run build:portfolio` and confirm `public/showcase/index.html` uses the correct base path.
- [ ] Run `git diff --check` and confirm no whitespace error.
- [ ] Run `git status --short` and confirm only intentional showcase changes remain.
- [ ] Review the implementation against every acceptance criterion in `docs/superpowers/specs/2026-07-21-cosmic-genesis-webgl-showcase-design.md`.
