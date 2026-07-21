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

## Initial Fix-Wave Focused Verification

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

## Initial Fix-Wave Complete Verification Gate

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

## Senior Re-review Follow-up

Follow-up baseline: `bb2660be2fdbace6b69fe614cede7b7ce5182333`

### Files Changed

- `.superpowers/sdd/final-review-fixes-report.md`
- `.superpowers/sdd/hybrid-verification-report.md`
- `src/components/AppShell.test.tsx`
- `src/components/AppShell.tsx`
- `src/three/backgroundScene.test.ts`
- `src/three/backgroundScene.ts`

### Unknown Forward POP after reload/session restore

RED command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
src/components/AppShell.test.tsx (17 tests | 1 failed)
× uses browser history indices for an unknown Forward POP from an initial middle entry
Expected: forwardExit/forwardExitActive
Received: backwardExit/backwardExitActive
Test Files  1 failed (1)
Tests  1 failed | 16 passed (17)
```

GREEN command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  17 passed (17)
```

The transition tracker now stores a finite `window.history.state.idx` when available. POP compares finite prior and target browser indices first, so lower is backward and higher is forward even for unseen keys. Without comparable browser indices it uses known local-key ordering; only an unknown, otherwise undecidable POP takes the deterministic backward fallback. Unknown entries are inserted on the resolved side of the current local entry. Initial, PUSH, and REPLACE remain forward, and the existing known Back/Forward and rapid-reentry tests remain intact.

### Renderer creation failure reporting

RED command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts
```

Relevant output:

```text
src/three/backgroundScene.test.ts (32 tests | 1 failed)
× reports and rethrows renderer creation failures without disposing an unacquired renderer
Expected onFailure to be called once; received 0 calls.
Test Files  1 failed (1)
Tests  1 failed | 31 passed (32)
```

GREEN command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts
```

Relevant output:

```text
Test Files  1 passed (1)
Tests  32 passed (32)
```

Renderer creation is now the first guarded acquisition. A factory error calls `onFailure` exactly once with the same error object and rethrows it. No renderer is disposed because none was acquired. All post-renderer field/setup, compilation, render, context-loss, and idempotent disposal tests continue to pass.

### Follow-up focused verification

Affected two-file command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx src/three/backgroundScene.test.ts
```

```text
Test Files  2 passed (2)
Tests  49 passed (49)
```

Required five-file command:

```powershell
npm.cmd test -- src/three/particleShaders.test.ts src/three/backgroundScene.test.ts src/components/AppShell.test.tsx src/styles/contrast.test.ts src/pages/ProjectPage.test.tsx
```

```text
Test Files  5 passed (5)
Tests  67 passed (67)
Duration  3.09s
```

### Follow-up complete verification gate

Command:

```powershell
npm.cmd run verify
```

Output:

```text
Test Files  14 passed (14)
Tests  118 passed (118)
TypeScript: tsc -b --pretty false (no errors)
Vite 8.1.4: 76 modules transformed
dist/index.html                   0.56 kB | gzip:   0.34 kB
dist/assets/index-Dk54oX0J.css    6.74 kB | gzip:   1.85 kB
dist/assets/index-BP7nKpiK.js   802.74 kB | gzip: 221.50 kB
built in 562ms
Exit code: 0
```

`dist/index.html` and `dist/404.html` both have SHA-256 `9F507031741A3F2E8663B730301D3E376DB04C6B965F905A8F5CA4F7785D000D`.

### Follow-up self-review

- Browser indices are used only when both prior and target values are finite and unequal; MemoryRouter/no-index behavior still relies on the tested local key ordering.
- Unknown Forward insertion preserves future local ordering, while an undecidable unknown POP retains the documented backward fallback.
- Existing initial/PUSH/REPLACE, known Back/Forward, captured outlet, 500 ms, and rapid accessibility semantics remain covered.
- Renderer-factory failure preserves original error identity, one callback, one factory call, and zero disposal of an unacquired renderer.
- The renderer/field transaction and all normal failure/disposal paths remain unchanged after successful renderer acquisition.
- No visual, particle, style, content, or unrelated architecture changed in this follow-up.

### Follow-up diff and status evidence

Commands were run separately after the implementation and both report updates:

```powershell
git diff --check
git status --short
```

`git diff --check` exited `0` with no whitespace errors; Git emitted only the repository's LF-to-CRLF working-copy notices. `git status --short` exited `0` with exactly this six-file follow-up scope:

```text
 M .superpowers/sdd/final-review-fixes-report.md
 M .superpowers/sdd/hybrid-verification-report.md
 M src/components/AppShell.test.tsx
 M src/components/AppShell.tsx
 M src/three/backgroundScene.test.ts
 M src/three/backgroundScene.ts
```

## 2026-07-21 Consolidated Unified-Width Final Review Fix Wave

### Scope and approved behavior

This wave addressed every Important and Minor item in `final-review-fixes-2026-07-21.md`. It preserves the approved single fluid 900px shell; always-on particle, route, and media motion without `?motion=full` or reduced-motion suppression; project-video play on hover/focus and pause/reset on leave/blur; and existing responsive, theme, visibility, and fallback behavior.

### Finding 1: Time-based damping — Important

RED command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts
```

Observed RED: exit code `1`; 1 failed and 32 passed. Equal one-second convergence at 30 Hz and 120 Hz differed as expected under per-frame damping (`uPointer.x` approximately `601.744` versus `887.921`).

Minimal fix: replaced fixed per-frame `applyTargets(0.035)` with `1 - exp(-rate * cappedDeltaSeconds)`. The rate is calibrated from the former 0.035 coefficient at 60 Hz. The first callback uses a defined 1/60-second damping interval while simulated elapsed time retains its prior zero-delta first-frame semantics. Tests now compare equal elapsed-time pointer/palette convergence across 30 Hz and 120 Hz and retain first-frame pointer/theme interpolation coverage without encoding one frame coefficient.

GREEN command: same as RED.

Observed GREEN: exit code `0`; 1 file and all 33 tests passed.

### Finding 2: Exact navigation state — Important

RED command:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx
```

Observed RED: exit code `1`; 2 failed and 18 passed. Work incorrectly had `aria-current="page"` on `/works/webgl-minecraft`, and Contact incorrectly had it on `/contact/missing`.

Minimal fix: set Work and Contact `NavLink` entries to exact matching with `end: true`.

GREEN command: same as RED.

Observed GREEN: exit code `0`; 1 file and all 20 tests passed.

### Finding 3: Transactional canvas integration — Important

RED command:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx
```

Observed RED: exit code `1`; 3 failed and 14 passed. `ResizeObserver` construction and `observe()` errors escaped the effect, and a controller resize error escaped the observer callback instead of entering fallback.

Minimal fix: made every post-controller setup step part of one guarded transaction. Observer construction, observation, pointer/visibility listener attachment, and initial start now route synchronous failures through hidden fallback and idempotent teardown. Pointer and visibility listeners are tracked independently for partial-attachment cleanup. Resize callback failures enter the same path. Teardown continues across observer/listener/disposal cleanup errors and disposes the acquired controller at most once.

GREEN command: same as RED.

Observed GREEN: exit code `0`; 1 file and all 17 tests passed. The three required fault injections assert hidden fallback, contained errors, listener/observer cleanup where acquired, and exactly-once disposal after unmount.

### Finding 4: Video fallback listener cleanup — Minor

RED command:

```powershell
npm.cmd test -- src/pages/WorksPage.test.tsx
```

Observed RED: exit code `1`; 1 failed and 4 passed. A video error rendered fallback but removed none of the four hover/focus listeners.

Minimal fix: added a synchronous, idempotent interaction cleanup invoked by the media error handler. It removes all four listeners, clears its cleanup ref, and assigns `null` to the captured video reference before fallback renders. Later effect cleanup is a no-op.

GREEN command: same as RED.

Observed GREEN: exit code `0`; 1 file and all 5 tests passed. Hover/focus after fallback no longer calls `play()`, and unmount does not repeat listener cleanup.

### Finding 5: Current documentation — Minor

- Added and committed `docs/superpowers/plans/2026-07-21-unified-width-always-on-motion.md` with every completed implementation step checked.
- Appended the clearly dated 2026-07-21 addendum to the tracked hybrid verification report. It retains all historical observations while explicitly superseding the 600px, reduced-motion, and `?motion=full` policy with the approved 900px always-on policy.
- Recorded the fresh final verification command and exact 121-test/build result in that addendum.

### Covering focused verification

Command:

```powershell
npm.cmd test -- src/three/backgroundScene.test.ts src/components/AppShell.test.tsx src/components/BackgroundCanvas.test.tsx src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx
```

Result: exit code `0`; 5 test files and all 79 tests passed.

### Fresh final verification gate

Command:

```powershell
npm.cmd run verify
```

Result: exit code `0`.

```text
Test Files  14 passed (14)
Tests       121 passed (121)
TypeScript  tsc -b --pretty false (no errors)
Vite 8.1.4 76 modules transformed
dist/index.html                   0.56 kB | gzip:   0.33 kB
dist/assets/index-CxpaTgoW.css    6.20 kB | gzip:   1.75 kB
dist/assets/index-BhcyD2VB.js   802.52 kB | gzip: 221.42 kB
built in 500ms
```

Vite emitted the existing non-blocking advisory for a minified chunk over 500 kB. SPA fallback generation completed.

Final whitespace command:

```powershell
git diff --check
```

Result: exit code `0`; Git emitted only the repository's LF-to-CRLF working-copy advisories, with no whitespace errors. The staged form also passed `git diff --cached --check` before commit.

### Files changed and commit

Committed files:

- `.superpowers/sdd/hybrid-verification-report.md`
- `docs/superpowers/plans/2026-07-21-unified-width-always-on-motion.md`
- `src/components/AppShell.test.tsx`
- `src/components/BackgroundCanvas.test.tsx`
- `src/components/BackgroundCanvas.tsx`
- `src/components/Navigation.tsx`
- `src/components/ProjectMedia.tsx`
- `src/pages/WorksPage.test.tsx`
- `src/three/backgroundScene.test.ts`
- `src/three/backgroundScene.ts`

Commit: `b1fc249 fix: harden always-on portfolio integration`

This report was appended after the implementation commit so it could record the actual hash, then committed separately as durable review evidence.

### Self-review

- Re-read all five findings against the final diff and verified each requested production path and regression is present.
- Confirmed the implementation does not reintroduce a Work-only shell class, `?motion=full`, reduced-motion suppression, static canvas branching, or disabled video playback.
- Confirmed time damping is based on capped elapsed seconds and first-frame pointer/palette state advances with a finite coefficient while elapsed-time accounting remains unchanged.
- Confirmed observer construction, observation, partial listener attachment, initial start, and resize callback failures all converge on one idempotent fallback/teardown path.
- Confirmed video error cleanup removes listeners synchronously, releases the captured detached node, blocks later playback, and remains idempotent on unmount.
- Independent read-only final review reported no Critical or Important issues. Its sole Minor item was the missing current report append, resolved by this section.
- Only the existing Vite large-chunk advisory remains; it is non-blocking and outside this fix-wave scope.
