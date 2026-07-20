# Original Portfolio Hybrid Verification

## Scope

- Browser-matrix commit: `5612571759df725ac5f105bf67304b3516386875`
- Final-review baseline: `28d762f0c87c1e9b64ff0ede857c632bf9790321`
- Earlier preview: `http://127.0.0.1:5174/?motion=full`
- Required viewports: desktop `1440x900`; mobile `390x844`
- Post-review corrections are verified below by fresh automated and source evidence; no new browser matrix or retained visual artifact is claimed.

## Fresh Final Automated Gate

Focused covering command:

```powershell
npm.cmd test -- src/three/particleShaders.test.ts src/three/backgroundScene.test.ts src/components/AppShell.test.tsx src/styles/contrast.test.ts src/pages/ProjectPage.test.tsx
```

Result: exit code `0`; 5 test files passed, 67 tests passed, 0 failed.

Complete gate command:

```powershell
npm.cmd run verify
```

Result: exit code `0`.

- Vitest: 14 test files passed; 118 tests passed; 0 failed.
- TypeScript: `tsc -b --pretty false` completed without errors.
- Vite: 76 modules transformed; the production build completed in 562 ms.
- SPA fallback: `dist/404.html` exists and has the same SHA-256 hash as `dist/index.html`: `9F507031741A3F2E8663B730301D3E376DB04C6B965F905A8F5CA4F7785D000D`.
- Advisory: Vite reported the existing main-chunk size warning (`802.74 kB`, `221.50 kB` gzip); this is non-blocking and outside the acceptance scope.

Diff and status evidence is recorded separately in the final-review fix report so command success and the pre-commit file inventory are unambiguous.

## Browser Matrix

The earlier running worktree preview was exercised in the in-app browser at the browser-matrix commit. Contemporaneous manual visual observations were made for desktop dark Home, desktop Works, desktop WebGL detail, desktop light Contact, and mobile dark Home. Each was readable, visually contained behind the content, and matched the expected original layout. No screenshot artifacts are retained or committed with this report.

### Desktop: 1440x900

- Home rendered the exact original headings, body copy, tool list, and footer copy. Computed body colors were `rgb(34, 34, 34)` and `rgb(204, 204, 204)` in the default dark theme. The shell had `max-width: 600px` with 24 px side padding, the canvas measured `1440x900`, exactly one semantic main was present after settling, and the document had no horizontal overflow.
- Desktop exposed no mobile-menu toggle; contemporaneous manual inspection showed the original inline Home, Work, and Contact navigation.
- Two temporary forced-motion Home frame captures compared within the live session, 500 ms apart, measured 83,713 and 83,845 bytes; the comparison found 83,010 differing bytes. This was a contemporaneous observation consistent with the expected animation under `?motion=full`. Because the temporary captures were not retained, it is not independently reproducible evidence.
- Works rendered exactly seven project links in the required order. The shell had `max-width: 900px`, the grid computed to `284px 284px 284px`, and the first media item computed to `grayscale(1)`. All five videos reached `readyState === 4`; both images completed with `naturalWidth > 0`.
- Every project detail route was opened: `/works/webgl-minecraft`, `/works/endless-city`, `/works/flappy-pixie`, `/works/civio`, `/works/particle-simulation`, `/works/fitmed`, and `/works/kiteprint`. Each showed the expected title, date, media, and source destination. Each used the 900 px work shell, approximately `578.656px / 289.344px` detail columns, and had no horizontal overflow.
- Contact rendered the original destinations and flair. Switching to the light theme produced a `white` body, `rgb(255, 255, 255)` background, `rgb(0, 0, 0)` text, `color-scheme: light`, a `Switch to dark theme` control label, and a visible light-palette canvas.
- The missing route rendered `404`, `not found`, and `Sorry. This page does not exist.` with one semantic main and no horizontal overflow.
- The full Home, Works, seven-detail, Contact, and 404 route pass was performed in the default dark theme. Light theme was exercised live on Contact with computed body, text, color-scheme, control-label, and canvas evidence; shell-global theme synchronization is additionally covered by the passing AppShell/component tests. The report does not claim that every route was revisited manually in light theme.
- During a PUSH from Home to Work, the incoming Work main carried the forward enter/active classes while the outgoing Home main carried the forward exit/active classes plus `aria-hidden="true"` and `inert`. A POP within 500 ms restored Home as the sole main with neither accessibility attribute; both remained absent after the transition settled. This live check resolves the Task 4 interrupted-re-entry hardening item.

### Mobile: 390x844

The browser's content width was 375 px because of its scrollbar.

- Without the query override, `matchMedia("(prefers-reduced-motion: reduce)").matches` was `true`. The canvas measured `375x844`, the closed menu had `display: none` and `aria-expanded="false"`, the layout was 311 px wide, and document width was 375 px. Temporary paired frame captures compared within the live session were byte-identical at 35,904 bytes with zero differing bytes. This was a contemporaneous observation consistent with the expected static reduced-motion constellation. Because the temporary captures were not retained, it is not independently reproducible evidence.
- Opening the menu changed it to `display: block`, `aria-expanded="true"`, and the accessible label `Close navigation menu`, with all three links visible. Selecting Work closed the menu and restored `aria-expanded="false"`.
- Works showed seven cards in one 311 px column with no horizontal overflow. A project detail used one 326 px column, with both its media and detail content measuring 326 px and no overflow.
- With `?motion=full`, temporary paired frame captures compared within the live session measured 33,690 and 33,523 bytes with 33,072 differing bytes. This was a contemporaneous observation consistent with the development override re-enabling animation at the mobile viewport. Because the temporary captures were not retained, it is not independently reproducible evidence.

### Source- and Test-Backed Acceptance Evidence

The following requirements were not directly quantified in the live browser and are reported separately from manual observations:

- Typography and shell details: source inspection shows that `src/styles/global.scss` imports Questrial and declares `font-family: "Questrial", sans-serif`; contemporaneous manual inspection showed typography consistent with that declaration. A focused follow-up browser recovery returned `No browser is available`, so `document.fonts.status`, `document.fonts.check("14px Questrial")`, and the computed body `fontFamily` were not measured. The strengthened `src/styles/contrast.test.ts` now binds Questrial, spacing and breakpoints, shell widths, navigation/footer borders and separation, Works/detail grids, card/tag geometry, both media reveal scopes, and reduced-motion suppression to their exact selectors.
- Pointer response: forced-motion animation was observed live during the earlier matrix, but cursor bending and autonomous return were not separately measured. Passing coverage in `src/three/particleShaders.test.ts`, `src/three/backgroundScene.test.ts`, and `src/components/BackgroundCanvas.test.tsx` verifies the pointer-reactive field/pulses, normalized and damped pointer input, capped velocity integration, and energy decay.
- Touch scrolling: live scroll energy was not instrumented. The passing `BackgroundCanvas.test.tsx` case `keeps touch scrolling autonomous and resets the next mouse velocity sample` verifies that touch movement does not energize the field or pollute the next mouse sample.
- Theme interpolation: the final light palette had a contemporaneous manual visual inspection; the exact passing `AppShell > toggles page and particle themes together without persistence` test verifies coordinated document and particle theme application, while `backgroundScene.test.ts` verifies intermediate palette interpolation. The intermediate interpolation was not directly measured in the live browser.
- Curl-driven temporary clusters are verified by shader source inspection and the passing `particleShaders.test.ts` cases `builds coordinated motion from two finite-difference curl layers`, `forms, breathes, dissolves, and seamlessly reforms migrating clusters`, and `keeps ambient particles, signal anchors, and connection endpoints attached`. No new browser observation or retained visual artifact is claimed.

### Media Interaction

The live browser environment reports reduced motion, so video hover playback is intentionally suppressed by the application. The grayscale baseline was verified live. `WorksPage > plays video previews from card hover and keyboard focus, then pauses and resets them` covers card hover/leave and focus/blur. `ProjectPage > plays detail video media on hover, then pauses and resets it` covers detail hover/leave only; detail focus/blur is not claimed. Reduced-motion suppression remains covered. CSS contract coverage verifies card and detail image/video `grayscale(1)` to `grayscale(0)` reveal and the 400 ms transition.

## Browser Console

After the documented dark-route, light-Contact, transition, media-load, desktop, mobile, and motion checks, the browser console contained no warnings or errors.

Browser control was available for the main matrix. The deliverable tab was then finalized and the controlled browser session released. A later recovery attempt for FontFaceSet evidence returned `No browser is available`, so no later browser measurement was obtained.

## Source Corrections

The final whole-branch review produced corrective RED/GREEN cycles for layered curl and zero-floor cluster lifetimes; known Back/Forward ordering; browser-indexed unknown POP direction with a deterministic backward fallback only when neither browser nor local ordering can decide; exact pathname-derived titles; detail image/video reveal and selector-scoped style locks; renderer-creation failure reporting; and transaction-safe renderer/field construction. The rapid PUSH/POP behavior that passed live is now protected by an automated accessibility regression. Exact commands and relevant RED/GREEN output are recorded in `.superpowers/sdd/final-review-fixes-report.md`.

## Concerns

- The existing Vite main-chunk size advisory remains outside this fix-wave scope.
- The browser's operating preference is reduced motion, so live video hover playback was correctly suppressed; its normal-motion interaction lifecycle is covered by automated tests rather than a live playback observation.
- Every route was inspected live in dark theme; light theme was inspected live on Contact rather than revisiting every route. Theme synchronization across the shell and particle scene is covered by automated tests.
- Questrial, pointer bending/return, touch-scroll energy, intermediate theme interpolation, and the post-review curl/lifetime corrections have source/automated evidence but were not separately instrumented in a new manual browser session. In particular, the focused follow-up could not obtain FontFaceSet or computed-font values because no browser was available. These are manual-coverage limitations, not reproduced product defects.
