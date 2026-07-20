# Original Portfolio Hybrid Verification

## Scope

- Input commit: `5612571759df725ac5f105bf67304b3516386875`
- Preview: `http://127.0.0.1:5174/?motion=full`
- Required viewports: desktop `1440x900`; mobile `390x844`
- Source corrections: none identified during the automated gate

## Automated Gate

Command:

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Result: exit code `0`.

- Vitest: 14 test files passed; 98 tests passed; 0 failed.
- TypeScript: `tsc -b --pretty false` completed without errors.
- Vite: 76 modules transformed; the final production build completed in 734 ms.
- SPA fallback: `dist/404.html` exists and has the same SHA-256 hash as `dist/index.html`: `4B3517C95905E365A77CD71A500791324CC5D52956F1BF00675249D420790931`.
- `git diff --check` reported no whitespace errors.
- `git status --short` produced no output before report creation.
- Advisory: Vite reported the existing main-chunk size warning (`798.49 kB`, `220.39 kB` gzip); this is non-blocking and outside the acceptance scope.

## Browser Matrix

The running worktree preview was exercised in the in-app browser. Screenshots were captured and visually inspected for desktop dark Home, desktop Works, desktop WebGL detail, desktop light Contact, and mobile dark Home. Each was readable, visually contained behind the content, and matched the expected original layout.

### Desktop: 1440x900

- Home rendered the exact original headings, body copy, tool list, and footer copy. Computed body colors were `rgb(34, 34, 34)` and `rgb(204, 204, 204)` in the default dark theme. The shell had `max-width: 600px` with 24 px side padding, the canvas measured `1440x900`, exactly one semantic main was present after settling, and the document had no horizontal overflow.
- Desktop exposed no mobile-menu toggle; the screenshot showed the original inline Home, Work, and Contact navigation.
- Two forced-motion Home frames taken 500 ms apart measured 83,713 and 83,845 bytes; the comparison found 83,010 differing bytes. This proves the constellation was actively animating under `?motion=full`.
- Works rendered exactly seven project links in the required order. The shell had `max-width: 900px`, the grid computed to `284px 284px 284px`, and the first media item computed to `grayscale(1)`. All five videos reached `readyState === 4`; both images completed with `naturalWidth > 0`.
- Every project detail route was opened: `/works/webgl-minecraft`, `/works/endless-city`, `/works/flappy-pixie`, `/works/civio`, `/works/particle-simulation`, `/works/fitmed`, and `/works/kiteprint`. Each showed the expected title, date, media, and source destination. Each used the 900 px work shell, approximately `578.656px / 289.344px` detail columns, and had no horizontal overflow.
- Contact rendered the original destinations and flair. Switching to the light theme produced a `white` body, `rgb(255, 255, 255)` background, `rgb(0, 0, 0)` text, `color-scheme: light`, a `Switch to dark theme` control label, and a visible light-palette canvas.
- The missing route rendered `404`, `not found`, and `Sorry. This page does not exist.` with one semantic main and no horizontal overflow.
- The full Home, Works, seven-detail, Contact, and 404 route pass was performed in the default dark theme. Light theme was exercised live on Contact with computed body, text, color-scheme, control-label, and canvas evidence; shell-global theme synchronization is additionally covered by the passing AppShell/component tests. The report does not claim that every route was revisited manually in light theme.
- During a PUSH from Home to Work, the incoming Work main carried the forward enter/active classes while the outgoing Home main carried the forward exit/active classes plus `aria-hidden="true"` and `inert`. A POP within 500 ms restored Home as the sole main with neither accessibility attribute; both remained absent after the transition settled. This live check resolves the Task 4 interrupted-re-entry hardening item.

### Mobile: 390x844

The browser's content width was 375 px because of its scrollbar.

- Without the query override, `matchMedia("(prefers-reduced-motion: reduce)").matches` was `true`. The canvas measured `375x844`, the closed menu had `display: none` and `aria-expanded="false"`, the layout was 311 px wide, and document width was 375 px. Paired screenshots were byte-identical at 35,904 bytes with zero differing bytes, proving a static reduced-motion constellation.
- Opening the menu changed it to `display: block`, `aria-expanded="true"`, and the accessible label `Close navigation menu`, with all three links visible. Selecting Work closed the menu and restored `aria-expanded="false"`.
- Works showed seven cards in one 311 px column with no horizontal overflow. A project detail used one 326 px column, with both its media and detail content measuring 326 px and no overflow.
- With `?motion=full`, paired frames measured 33,690 and 33,523 bytes with 33,072 differing bytes, proving that the development override re-enabled animation at the mobile viewport.

### Source- and Test-Backed Acceptance Evidence

The following requirements were not directly quantified in the live browser and are reported separately from manual observations:

- Typography and shell details: `src/styles/global.scss` imports Questrial and sets `font-family: "Questrial", sans-serif`; inspected screenshots visibly used that face. `src/styles/contrast.test.ts` covers the navigation bottom border, footer top border, 5rem navigation separation, widths, and 400 ms grayscale reveal contract.
- Pointer response: forced-motion animation was proven live, but cursor bending and autonomous return were not separately measured. Passing coverage in `src/three/particleShaders.test.ts`, `src/three/backgroundScene.test.ts`, and `src/components/BackgroundCanvas.test.tsx` verifies the pointer-reactive field/pulses, normalized and damped pointer input, capped velocity integration, and energy decay.
- Touch scrolling: live scroll energy was not instrumented. The passing `BackgroundCanvas.test.tsx` case `keeps touch scrolling autonomous and resets the next mouse velocity sample` verifies that touch movement does not energize the field or pollute the next mouse sample.
- Theme interpolation: the final light palette was visually inspected live; automated scene and AppShell coverage verifies coordinated particle/document theme application. The intermediate interpolation was not directly measured in the live browser.

### Media Interaction

The live browser environment reports reduced motion, so video hover playback is intentionally suppressed by the application. The grayscale baseline was verified live. Passing `WorksPage.test.tsx` and `ProjectPage.test.tsx` coverage verifies normal-motion hover/focus play, leave/blur pause and reset-to-zero, plus reduced-motion suppression; CSS and contract coverage verifies the `grayscale(1)` to `grayscale(0)` reveal and 400 ms transition.

## Browser Console

After the documented dark-route, light-Contact, transition, media-load, desktop, mobile, and motion checks, the browser console contained no warnings or errors.

The final in-app browser tab was left visible at `http://127.0.0.1:5174/?motion=full` with its viewport returned to the normal application view.

## Source Corrections

None. The rapid PUSH/POP hardening item passed live, and the remaining acceptance checks exposed no source defect; therefore no corrective RED/GREEN cycle was required.

## Concerns

- The existing Vite main-chunk size advisory remains outside Task 5 scope.
- The browser's operating preference is reduced motion, so live video hover playback was correctly suppressed; its normal-motion interaction lifecycle is covered by automated tests rather than a live playback observation.
- Every route was inspected live in dark theme; light theme was inspected live on Contact rather than revisiting every route. Theme synchronization across the shell and particle scene is covered by automated tests.
- Questrial, pointer bending/return, touch-scroll energy, and intermediate theme interpolation have source/automated evidence but were not separately instrumented in the manual browser session. These are manual-coverage limitations, not reproduced product defects.
