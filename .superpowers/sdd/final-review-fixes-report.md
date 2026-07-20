# Final Whole-Branch Review Fix Report

Date: 2026-07-20

Baseline: `28d762f0c87c1e9b64ff0ede857c632bf9790321`

## Status

Every required final-review correction is implemented. The final focused suite and complete verification gate pass. An independent read-only review found no Critical, Important, or Minor issues.

## Files Changed

- `.superpowers/sdd/final-review-fixes-report.md`
- `.superpowers/sdd/hybrid-verification-report.md`
- `src/components/AppShell.test.tsx`
- `src/components/AppShell.tsx`
- `src/styles/contrast.test.ts`
- `src/styles/work.module.scss`
- `src/three/backgroundScene.test.ts`
- `src/three/backgroundScene.ts`
- `src/three/particleShaders.test.ts`
- `src/three/particleShaders.ts`

No particle-field attribute or draw-call change was needed. Existing `aSeed` data already supplies stable cluster identity and is copied unchanged to signal anchors and connection endpoints.

## RED/GREEN Evidence

### 1. Curl-driven temporary clusters

Initial RED command:

```powershell
npm.cmd test -- src/three/particleShaders.test.ts
```

Relevant output:

```text
src/three/particleShaders.test.ts (5 tests | 3 failed)
× builds coordinated motion from two finite-difference curl layers
× forms, breathes, dissolves, and seamlessly reforms migrating clusters
× keeps ambient particles, signal anchors, and connection endpoints attached
Test Files  1 failed (1)
Tests  3 failed | 2 passed (5)
```

The failures showed the old shader had no `flowPotential`, `curlFlow`, lifecycle envelope, or layered curl path. After the first implementation pass, the curl test exposed that an algebraic substring was too syntactic. The test was strengthened to require symmetric samples, all six finite-difference derivatives, distinct frequency inputs, and non-aliased cluster identity. That corrected RED remained behavior-specific:

```text
src/three/particleShaders.test.ts (5 tests | 2 failed)
× builds coordinated motion from two finite-difference curl layers
× forms, breathes, dissolves, and seamlessly reforms migrating clusters
Test Files  1 failed (1)
Tests  2 failed | 3 passed (5)
```

GREEN command:

```powershell
npm.cmd test -- src/three/particleShaders.test.ts
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  5 passed (5)
```

Self-review then removed the dormant 8% visibility floor so cluster groups truly disappear. Refinement RED used the same command:

```text
src/three/particleShaders.test.ts (5 tests | 1 failed)
× forms, breathes, dissolves, and seamlessly reforms migrating clusters
Expected: float lifetimeVisibility = clusterLifetime(aSeed)
Received: float lifetimeVisibility = mix(0.08, 1.0, clusterLifetime(aSeed))
Tests  1 failed | 4 passed (5)
```

Final refinement GREEN:

```text
Test Files  1 passed (1)
Tests  5 passed (5)
```

Implementation evidence: a trigonometric vector potential is sampled at symmetric positive/negative offsets to calculate all three components of `curl(A)`. Low- and detail-frequency layers feed one coordinated drift. Stable reconstructed cluster identity drives smooth formation and dissolution; continuous time drives center migration and breathing. Ambient alpha, signal energy, and connection visibility use the zero-floor lifetime. Ambient particles, signals, and endpoints all call the same `displacedPosition` function. Pointer tangent bending, speed energy, quality/content fades, pulses, GPU-only position calculation, and the existing three draw objects remain intact.

### 2. Back, Forward, unknown POP, and rapid reversal accessibility

RED command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
src/components/AppShell.test.tsx (9 tests | 2 failed)
× uses backward classes for browser Back and forward classes for browser Forward
× uses forward classes for replace and a deterministic backward fallback for unknown pops
Expected forwardExit/forwardExitActive; received backwardExit/backwardExitActive on Forward.
Expected backwardExit/backwardExitActive; received forwardExit/forwardExitActive on an unknown POP.
Test Files  1 failed (1)
Tests  2 failed | 7 passed (9)
```

The rapid PUSH-then-POP accessibility regression was included in this RED group and already passed, proving the regression protects existing restoration behavior rather than inventing it after the implementation.

GREEN command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  9 passed (9)
```

The local keyed history now preserves entry order, truncates forward history on PUSH, replaces the current key on REPLACE, compares known POP indices, and inserts unknown POP entries immediately before the current entry as a deterministic backward fallback. Same-key renders are idempotent. Initial appearance remains forward. Captured outlets, `childFactory`, `appear`, 500 ms timing, and outgoing `aria-hidden`/`inert` behavior are unchanged. The restored main lacks both accessibility attributes immediately and after settlement.

### 3. Detail image/video color reveal and 5. exact selector locks

Initial RED command:

```powershell
npm.cmd test -- src/styles/contrast.test.ts
```

Relevant output:

```text
src/styles/contrast.test.ts (9 tests | 2 failed)
× reveals card and detail image or video color over 400ms
× suppresses the shared image and video transition for reduced motion
```

The second failure identified a CRLF-sensitive test helper, not a product defect. After normalizing line endings, the corrected behavior RED was:

```text
src/styles/contrast.test.ts (9 tests | 1 failed)
× reveals card and detail image or video color over 400ms
Expected detail reveal block to match filter: grayscale(0);
Received: ""
Test Files  1 failed (1)
Tests  1 failed | 8 passed (9)
```

GREEN command:

```powershell
npm.cmd test -- src/styles/contrast.test.ts src/pages/ProjectPage.test.tsx
```

Relevant output:

```text
Test Files  2 passed (2)
Tests  13 passed (13)
```

The added detail selector changes only the filter. The existing shared media rule retains the exact 400 ms transition, and reduced motion still suppresses it. The balanced-block style tests bind Questrial, `$spacing`, both breakpoints, navigation/footer borders and separation, both shell widths, Works columns, detail columns, card/tag geometry, card/detail media reveal, and reduced-motion declarations to their exact selectors or media blocks.

### 4. Exact original document titles

RED command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
src/components/AppShell.test.tsx (16 tests | 7 failed)
× derives the document title for / from the final pathname segment
× derives the document title for /works from the final pathname segment
× derives the document title for /contact from the final pathname segment
× derives the document title for /works/webgl-minecraft from the final pathname segment
× derives the document title for /works/particle-simulation from the final pathname segment
× derives the document title for /missing-page from the final pathname segment
× updates the exact original document title after navigation
Expected route-derived titles; received "stale title".
Test Files  1 failed (1)
Tests  7 failed | 9 passed (16)
```

GREEN command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  16 passed (16)
```

The route effect uses the last nonempty pathname segment, falls back to `Home`, and capitalizes only the first character. Direct coverage locks `/`, `/works`, `/contact`, two project slugs, and `/missing-page`, plus an in-session route change.

### 6. Transaction-safe renderer/field construction

RED command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts
```

Relevant output:

```text
src/three/backgroundScene.test.ts (31 tests | 2 failed)
× cleans up the renderer and reports a particle-field construction failure once
× disposes a constructed field when scene attachment fails
The injected factory was not called; renderer disposal/onFailure cleanup was absent.
Test Files  1 failed (1)
Tests  2 failed | 29 passed (31)
```

GREEN command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  31 passed (31)
```

The narrow `createField` option is the only new seam. Scene, camera, field, and attachment setup are one transaction after renderer creation. Failure disposes an available field once, disposes the renderer once, calls `onFailure` once with the original error, and rethrows it. Existing compile/render/context-loss failure handling and idempotent normal disposal continue to pass.

### 7. Verification evidence corrections

This is a documentation-only group, so no production RED/GREEN cycle applies. `.superpowers/sdd/hybrid-verification-report.md` now separates the fresh commands/results, names the coordinated theme test, scopes card and detail media interactions accurately, describes curl/lifetime behavior as source/test verified, clarifies browser chronology, and characterizes unretained byte comparisons only as contemporaneous observations.

## Final Focused Verification

Command:

```powershell
npm.cmd test -- src/three/particleShaders.test.ts src/three/backgroundScene.test.ts src/components/AppShell.test.tsx src/styles/contrast.test.ts src/pages/ProjectPage.test.tsx
```

Output:

```text
Test Files  5 passed (5)
Tests  65 passed (65)
Duration  2.32s
```

## Complete Verification Gate

Command:

```powershell
npm.cmd run verify
```

Output:

```text
Test Files  14 passed (14)
Tests  116 passed (116)
TypeScript: tsc -b --pretty false (no errors)
Vite 8.1.4: 76 modules transformed
dist/index.html                   0.56 kB | gzip:   0.33 kB
dist/assets/index-Dk54oX0J.css    6.74 kB | gzip:   1.85 kB
dist/assets/index-DgehmhG-.js   802.35 kB | gzip: 221.38 kB
built in 460ms
Exit code: 0
```

`dist/index.html` and `dist/404.html` both have SHA-256 `2E88ABBD655864F9246EE86414EE75771E0FB2036E1339E8333B093C7E36CFFC`.

The existing Vite chunk-size advisory remains non-blocking and outside this fix-wave scope.

## Diff and Status Evidence

Commands were run separately after both reports were written:

```powershell
git diff --check
```

Result: exit code `0`; no whitespace errors. Git emitted only the repository's LF-to-CRLF working-copy notices.

```powershell
git status --short
```

Result: exit code `0` with the following pre-stage inventory:

```text
 M .superpowers/sdd/hybrid-verification-report.md
 M src/components/AppShell.test.tsx
 M src/components/AppShell.tsx
 M src/styles/contrast.test.ts
 M src/styles/work.module.scss
 M src/three/backgroundScene.test.ts
 M src/three/backgroundScene.ts
 M src/three/particleShaders.test.ts
 M src/three/particleShaders.ts
```

The new `.superpowers/sdd/final-review-fixes-report.md` exists but is hidden from ordinary status by `.gitignore:17` (`.superpowers/`). It is intentionally force-staged with the tracked fix wave. No unrelated file is present.

Post-stage commands:

```powershell
git diff --cached --check
git status --short
```

`git diff --cached --check` exited `0` with no output. The staged status was exactly:

```text
A  .superpowers/sdd/final-review-fixes-report.md
M  .superpowers/sdd/hybrid-verification-report.md
M  src/components/AppShell.test.tsx
M  src/components/AppShell.tsx
M  src/styles/contrast.test.ts
M  src/styles/work.module.scss
M  src/three/backgroundScene.test.ts
M  src/three/backgroundScene.ts
M  src/three/particleShaders.test.ts
M  src/three/particleShaders.ts
```

## Self-Review

- Design compliance: approved particle design governs; curl is an explicit central-difference construction with two spatial frequencies, continuous currents, stable cluster identity, smooth formation/dissolution, migration, breathing, and zero-floor temporary visibility.
- Back/Forward semantics: initial/PUSH/REPLACE are forward; known earlier/later POP entries are backward/forward; unknown POP fallback is deterministic; same-key rerenders do not corrupt order.
- Title fidelity: implementation matches `b29b772/src/components/Layout.jsx` exactly rather than using marketing titles.
- Selectors and appearance: detail reveal adds no geometry; exact original Questrial, spacing, breakpoints, borders, widths, grids, cards, tags, transitions, and reduced-motion suppression are locked in their owning blocks.
- Initialization/disposal: staged construction owns and cleans each acquired resource exactly once; successful-controller disposal, compilation failure, render failure, and context loss remain covered.
- Shader attachment continuity: particle positions, signal anchors, and connection endpoints retain identical seeds and the same displacement function.
- Quality/performance architecture: no CPU position updates, new attributes, draw calls, or post-processing were added; quality budgets, fades, and static medium-density reduced motion remain unchanged.
- Accessibility: outgoing mains remain hidden/inert, rapid restored mains are immediately and finally accessible, navigation behavior is unchanged, and the canvas remains decorative.
- Scope: only the required implementation/tests and the two required reports changed; the dirty main checkout was not touched.
- Test truthfulness: source assertions lock mathematical and wiring relationships rather than a generic function name; integration tests exercise actual router transitions and DOM accessibility; construction tests use a real field for post-construction cleanup.
- Independent review: no Critical, Important, or Minor issues; assessment `Ready — Yes`.

## Concerns

- No new controllable browser session or retained visual artifact was available after the final-review corrections. Curl/lifetime behavior is therefore source/test verified, not claimed as a new browser observation.
- The production build still emits the pre-existing main-chunk size advisory.
- If `createParticleField` itself allocates resources and throws before returning, it must clean its own unreturned allocations; `backgroundScene` can dispose only a field it has acquired. This ownership boundary is unchanged and is not a reproduced leak.
