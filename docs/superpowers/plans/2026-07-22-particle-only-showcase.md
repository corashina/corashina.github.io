# Particle-Only Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the multi-layer Cosmic Genesis scene with a fixed-low, particle-only interactive showcase.

**Architecture:** `ShowcaseApp` will own one fixed-size `ParticleSimulation` and a minimal composer containing scene render, luminance bloom, and output conversion. Runtime quality selection, adaptive sampling, proto-star, membrane, nebula, AO, SSR, shadows, and their source modules will be removed; the existing camera, pointer, pulse, recovery, and fallback lifecycle remains.

**Tech Stack:** TypeScript 7, Three.js 0.185.1, Vite 8, Vitest 4, Playwright 1.61.

## Global Constraints

- Particle simulation texture is fixed at 128 x 128: exactly 16,384 particles.
- Renderer device pixel ratio is capped at 1.0.
- Particles are the only visible simulated scene content.
- Keep subtle particle bloom without volumetric haze.
- Keep drag, zoom, click/tap pulse, keyboard controls, Reset View, reduced-motion behavior, WebGL recovery, and fallback handling.
- No runtime quality selector, adaptive quality, proto-star, membrane, nebula, GTAO, SSR, shadow, or scene-light execution.
- Preserve unrelated worktree changes until the obsolete modules are deliberately deleted in Task 5.
- Run `npm` commands from `showcase/`; run `git` and `rg` commands from the worktree root.

---

### Task 1: Fixed Particle Runtime

**Files:**
- Create: `showcase/src/particles/particleConfig.ts`
- Create: `showcase/src/particles/particleConfig.test.ts`
- Modify: `showcase/src/particles/ParticleSimulation.ts`
- Modify: `showcase/src/particles/ParticleSimulation.test.ts`

**Interfaces:**
- Produces: `PARTICLE_TEXTURE_SIZE: 128`, `PARTICLE_COUNT: 16384`, `MAX_PIXEL_RATIO: 1`.
- Produces: `new ParticleSimulation(renderer, options?)`; removes `setQuality()` and resolution crossfades.

- [ ] **Step 1: Write failing fixed-configuration tests**

```ts
expect(PARTICLE_TEXTURE_SIZE).toBe(128);
expect(PARTICLE_COUNT).toBe(128 * 128);
expect(MAX_PIXEL_RATIO).toBe(1);

const simulation = new ParticleSimulation(renderer, { computeFactory });
expect(points.geometry.drawRange.count).toBe(PARTICLE_COUNT);
expect(created).toHaveLength(1);
expect("setQuality" in simulation).toBe(false);
```

- [ ] **Step 2: Verify the focused tests fail**

Run: `npm test -- src/particles/particleConfig.test.ts src/particles/ParticleSimulation.test.ts`

Expected: FAIL because `particleConfig.ts` does not exist and the constructor still requires a profile.

- [ ] **Step 3: Add fixed constants and remove transition code**

```ts
export const PARTICLE_TEXTURE_SIZE = 128 as const;
export const PARTICLE_COUNT = PARTICLE_TEXTURE_SIZE * PARTICLE_TEXTURE_SIZE;
export const MAX_PIXEL_RATIO = 1 as const;
```

Change `ParticleSimulation` to create exactly one runtime with `PARTICLE_TEXTURE_SIZE`. Remove `QualityProfile`, `Transition`, `TRANSITION_DURATION`, `setQuality`, transition opacity handling, and `getEnergyTexture`; retain update, interaction uniforms, `getPositionTexture`, idempotent disposal, and constructor-failure cleanup.

- [ ] **Step 4: Run fixed particle tests**

Run: `npm test -- src/particles/particleConfig.test.ts src/particles/ParticleSimulation.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the fixed particle runtime**

```bash
git add showcase/src/particles/particleConfig.ts showcase/src/particles/particleConfig.test.ts showcase/src/particles/ParticleSimulation.ts showcase/src/particles/ParticleSimulation.test.ts
git commit -m "refactor: fix showcase particle density"
```

### Task 2: Minimal Particle Render Pipeline

**Files:**
- Modify: `showcase/src/rendering/RenderPipeline.ts`
- Modify: `showcase/src/rendering/RenderPipeline.test.ts`

**Interfaces:**
- Produces: `new RenderPipeline({ renderer, scene, camera })`.
- Produces: `render({ deltaSeconds })`, `resize(width, height, dpr)`, and idempotent `dispose()`.
- Exposes for verification: `composer`, `renderPass`, `bloomPass`, `outputPass`.

- [ ] **Step 1: Replace advanced-pipeline assertions with failing particle-pipeline assertions**

```ts
const pipeline = new RenderPipeline({ renderer, scene, camera });
expect(pipeline.composer.passes).toEqual([
  pipeline.renderPass,
  pipeline.bloomPass,
  pipeline.outputPass,
]);
expect(pipeline.bloomPass.strength).toBeLessThanOrEqual(0.75);
expect(pipeline.bloomPass.threshold).toBeGreaterThanOrEqual(0.5);
expect(renderer.shadowMap.enabled).toBe(false);
pipeline.resize(100, 60, 3);
expect(pipeline.composer.readBuffer.width).toBe(100);
expect(pipeline.composer.readBuffer.height).toBe(60);
```

Also assert source does not construct `GTAOPass`, `AuxiliaryReflectionPass`, `AuxiliaryBufferPass`, `NebulaPass`, or PCSS.

- [ ] **Step 2: Verify the render-pipeline test fails**

Run: `npm test -- src/rendering/RenderPipeline.test.ts`

Expected: FAIL because the constructor still requires removed systems and the composer has six passes.

- [ ] **Step 3: Implement the three-pass composer**

Use `EffectComposer`, `RenderPass`, `UnrealBloomPass`, and `OutputPass`. Configure `AgXToneMapping`, `SRGBColorSpace`, shadows off, and restrained bloom (`strength: 0.65`, `radius: 0.4`, `threshold: 0.55`). Resize at `Math.min(Math.max(dpr, 0.1), MAX_PIXEL_RATIO)` and restore renderer output/tone/shadow settings on disposal.

```ts
export type RenderPipelineOptions = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.Camera;
};

render(frame: Pick<FrameContext, "deltaSeconds">): void {
  if (!this.disposed) this.composer.render(Math.max(0, frame.deltaSeconds));
}
```

- [ ] **Step 4: Run render-pipeline tests**

Run: `npm test -- src/rendering/RenderPipeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the minimal render pipeline**

```bash
git add showcase/src/rendering/RenderPipeline.ts showcase/src/rendering/RenderPipeline.test.ts
git commit -m "refactor: render particles with minimal bloom"
```

### Task 3: Particle-Only Application Shell

**Files:**
- Modify: `showcase/src/app/ShowcaseApp.ts`
- Modify: `showcase/src/app/ShowcaseApp.test.ts`

**Interfaces:**
- `ShowcaseAppFactories` keeps renderer, scene, camera, interaction, camera controller, clock, particles, and pipeline factories only.
- `GpuSystems` becomes `{ particles: ParticleSystem; pipeline: Pipeline }`.
- `ShowcaseApp` keeps `start`, `stop`, `resetView`, `registerCleanup`, `dispose`, `isDisposed`; removes `setQualityMode` and `getQualityTransition`.

- [ ] **Step 1: Rewrite shell tests to require only particle systems**

```ts
expect(h.calls).toEqual([
  "renderer", "scene", "camera", "interaction", "controls", "particles", "pipeline",
]);

h.app.start();
h.runFrame();
expect(h.calls).toContain("particles.update");
expect(h.calls).not.toContain("proto.update");
expect(h.pipeline.render).toHaveBeenCalledAfter(h.cameraController.update);
expect(h.root.dataset.showcaseLayers).toBe("1");
expect(h.root.dataset.qualityTier).toBeUndefined();
expect(h.renderer.setPixelRatio).toHaveBeenCalledWith(1);
```

Retain and adapt compile, visibility, resize, context restoration, partial-construction cleanup, reset, frame failure, and idempotent-disposal tests.

- [ ] **Step 2: Verify the shell tests fail**

Run: `npm test -- src/app/ShowcaseApp.test.ts`

Expected: FAIL because the shell still creates lights and four removed GPU systems.

- [ ] **Step 3: Simplify `ShowcaseApp`**

Remove all imports/types/fields/factories for quality, lights, proto-star, membrane, and nebula. Create particles with `new ParticleSimulation(renderer)` and the pipeline with `{ renderer, scene, camera }`. Add only `particles.object` to the scene. In each fixed step update particles then camera; render afterward. Cap both renderer and pipeline DPR with `MAX_PIXEL_RATIO`. Recreate only particles and pipeline on context restoration and dispose them in reverse dependency order.

Set test telemetry to one layer:

```ts
this.root.dataset.showcaseLayers = "1";
this.root.dataset.reducedMotion = String(this.options.capabilities.reducedMotion);
```

- [ ] **Step 4: Run application tests**

Run: `npm test -- src/app/ShowcaseApp.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the particle-only application shell**

```bash
git add showcase/src/app/ShowcaseApp.ts showcase/src/app/ShowcaseApp.test.ts
git commit -m "refactor: reduce showcase to particles"
```

### Task 4: Remove Quality UI and Update Browser Contract

**Files:**
- Modify: `showcase/index.html`
- Modify: `showcase/src/styles.css`
- Modify: `showcase/src/main.ts`
- Modify: `showcase/src/main.test.ts`
- Delete: `showcase/src/quality-options.test.ts`
- Create: `showcase/src/showcase-shell.test.ts`
- Modify: `showcase/e2e/showcase.e2e.ts`
- Modify: `showcase/scripts/capture-fallback.mjs`

**Interfaces:**
- Bootstrap app contract becomes `Pick<ShowcaseApp, "start" | "resetView" | "dispose">` plus optional cleanup registration.
- HTML exposes one Reset View button and no `select`.
- Test telemetry no longer contains `data-quality-tier`; `data-showcase-layers` equals `1`.

- [ ] **Step 1: Write failing shell and browser-contract tests**

```ts
expect(document.querySelector("select")).toBeNull();
expect(document.querySelector(".interaction-hint")?.textContent).toContain("Click");
reset.click();
expect(app.resetView).toHaveBeenCalledOnce();
```

Update Playwright readiness to expect `data-showcase-layers="1"`; remove quality-tier loops and selector tests; retain pulse, orbit, zoom, reset, context recovery, fallback, and direct-navigation coverage.

- [ ] **Step 2: Verify UI tests fail**

Run: `npm test -- src/main.test.ts src/showcase-shell.test.ts`

Expected: FAIL because the selector and quality listener still exist.

- [ ] **Step 3: Remove quality controls and update copy**

Use the hint `Drag to orbit · Scroll to zoom · Click or tap to pulse`. Delete the quality label/select and quality query handling. Remove selector styling and cleanup. Update the fallback capture URL to `/showcase/?capture=1&test=1`.

- [ ] **Step 4: Run shell tests**

Run: `npm test -- src/main.test.ts src/showcase-shell.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit UI and browser-contract changes**

```bash
git add -A showcase/index.html showcase/src/styles.css showcase/src/main.ts showcase/src/main.test.ts showcase/src/quality-options.test.ts showcase/src/showcase-shell.test.ts showcase/e2e/showcase.e2e.ts showcase/scripts/capture-fallback.mjs
git commit -m "refactor: expose particle-only showcase controls"
```

### Task 5: Delete Removed Systems and Verify the Experience

**Files:**
- Delete: `showcase/src/core/*`
- Delete: `showcase/src/membrane/*`
- Delete: `showcase/src/volume/*`
- Delete: `showcase/src/quality/*`
- Delete: `showcase/src/rendering/AuxiliaryBufferPass.ts`
- Delete: `showcase/src/rendering/AuxiliaryBufferPass.test.ts`
- Delete: `showcase/src/rendering/MaskedBloomPass.ts`
- Delete: `showcase/src/rendering/MaskedBloomPass.test.ts`
- Delete: `showcase/src/rendering/deformationShadowMaterials.ts`
- Delete: `showcase/src/rendering/pcss.ts`
- Delete: `showcase/src/rendering/pcss.test.ts`
- Regenerate: `showcase/public/fallback.png`

**Interfaces:**
- No remaining source import refers to deleted scene or quality systems.
- Production and fallback views both depict the particle-only composition.

- [ ] **Step 1: Prove removed systems still exist**

Run: `rg -n "ProtoStar|SpaceMembrane|NebulaPass|QualityManager|GTAOPass|SSR|PCSS|MaskedBloomPass|Rendering quality" showcase/src showcase/index.html showcase/e2e`

Expected: matches in obsolete modules and tests.

- [ ] **Step 2: Delete obsolete source and test modules**

Delete exactly the files listed above after verifying no remaining imports. Do not delete interaction, particle, runtime, capability, app, or simplified render-pipeline modules.

- [ ] **Step 3: Run static and unit verification**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm test`

Expected: all remaining Vitest files pass.

Run: `npm run build`

Expected: production bundle builds at `/showcase/` without unresolved imports.

- [ ] **Step 4: Run Chromium browser verification**

Run: `npm run test:browser -- --project=chromium`

Expected: all particle-only interaction, direct-navigation, recovery, and fallback tests pass with no browser console errors.

- [ ] **Step 5: Regenerate and inspect the fallback**

Run: `npm run capture:fallback`

Expected: `showcase/public/fallback.png` is replaced by a valid 20 KB–1.5 MB particle-only capture.

Open the image and confirm it contains particles against the dark background with no blob, plane, reflection, or nebula veil.

- [ ] **Step 6: Commit removal and verified fallback**

```bash
git add -A showcase/src/core showcase/src/membrane showcase/src/volume showcase/src/quality showcase/src/rendering showcase/public/fallback.png
git commit -m "refactor: remove non-particle showcase systems"
```

- [ ] **Step 7: Final worktree verification**

Run: `git status --short`

Expected: only known ignored/generated artifacts remain, or a clean worktree.

Run: `git diff --check HEAD~5..HEAD`

Expected: no whitespace errors.
