# Website Performance Optimization Design

Date: 2026-07-24

## Summary

The portfolio will use layered performance optimization without changing its
visual identity. The work will split route code, defer the Three.js background,
stage portfolio media behind WebP posters, and recompress the existing MP4
previews. The current navigation, themes, project ordering, hover behavior, and
responsive layout remain recognizable.

## Baseline

The production audit established these starting points:

- The production entry is 806.75 kB minified and 222.52 kB gzip.
- Vite emits the application as one JavaScript chunk and warns that the chunk
  exceeds 500 kB.
- The portfolio directory contains 16.84 MB of media, including 16.37 MB across
  eleven MP4 files.
- Visiting `/works` exposes all eleven MP4 URLs immediately. In the runtime
  audit, every video reached `HAVE_ENOUGH_DATA` even though each element used
  `preload="metadata"`.
- Three.js and the animated background are part of the initial application
  dependency graph on every route.

## Goals

- Reduce initial JavaScript execution and transfer cost.
- Prevent off-screen portfolio videos from requesting data.
- Preserve responsive layout and avoid media-related layout shift.
- Preserve immediate, accessible project information when video or WebGL is
  unavailable.
- Make asset optimization and performance budgets reproducible.

## Non-goals

- Redesigning the pages, navigation, theme, typography, or project content.
- Adding a second video codec or maintaining multiple video variants.
- Replacing Three.js or rewriting the particle scene.
- Introducing a server-side rendering framework or changing GitHub Pages
  deployment.

## Architecture

### Route chunks

`App.tsx` will load Home, Works, project detail, Contact, and Not Found through
`React.lazy`. A `Suspense` fallback will preserve the route-stage dimensions
without adding a new loading animation. `AppShell`, navigation, theme handling,
and route transitions remain in the initial application graph.

Each route is downloaded on first navigation and then retained by the browser's
module cache.

### Deferred background

`BackgroundCanvas` remains a small, immediately rendered integration component,
but it will dynamically import `backgroundScene` only after the initial content
has painted. Scheduling uses `requestIdleCallback` with a 1.5-second timeout.
Browsers without that API use a cancellable 250 ms timeout.

The canvas uses the current CSS theme background while the import is pending.
After the module loads, the existing WebGL controller initializes and follows
the current resize, pointer, visibility, quality, theme, and disposal behavior.
Unmounting before initialization cancels the scheduled work and prevents scene
creation.

When `prefers-reduced-motion: reduce` matches, the controller renders one static
frame and does not start its animation loop.

### Staged project media

`ProjectMedia` will accept an explicit loading mode:

- `viewport` for media in Works cards.
- `eager` for primary media on a project-detail page.

Every video project receives a `posterSrc` in the project data. `ProjectMedia`
renders that WebP file as a real image layer with an error handler. A video
layer with the same fixed dimensions remains source-less and hidden while
inactive. This preserves the media aspect ratio, makes poster failure
observable, and avoids requesting MP4 data.

Viewport-mode video activation occurs when either condition is met:

- Its card enters a 200 px `IntersectionObserver` root margin.
- The card receives hover or keyboard focus.

Activation attaches the MP4 source once and changes preload from `none` to
`metadata`. The poster remains visible until the video emits `loadeddata`, then
the video becomes the visible layer. Interaction starts playback after
activation. Mouse leave or blur pauses the video and resets its current time,
but the source remains attached so the browser can reuse cached data.

Eager mode attaches the source on mount. Existing image projects use
`loading="lazy"` and `decoding="async"` in cards, and eager loading on detail
pages.

With reduced motion enabled, card videos remain poster-only and do not activate
on observation, hover, or focus. Detail videos attach their source but do not
auto-play on hover or focus; native controls allow explicit playback.

### Component boundaries

- `App` owns route-level code splitting.
- `BackgroundCanvas` owns deferred scene loading, motion preference handling,
  and WebGL lifecycle integration.
- A focused deferred-media hook owns observation, activation state, motion
  preference, and cleanup.
- `ProjectMedia` owns poster, image, video, playback, and fallback rendering.
- Project data owns the mapping from each media source to its poster.
- Offline scripts own media generation and build-budget validation.

These boundaries keep route behavior, WebGL behavior, and media loading
independently testable.

## Asset pipeline

An offline Node script will invoke FFmpeg for each
`static/portfolio/*.mp4`. It will write to temporary files and replace an
existing asset only after a successful encode.

The MP4 profile is:

- H.264 using `libx264`.
- Maximum width 960 px with no upscaling and preserved aspect ratio.
- Maximum frame rate 30 fps.
- CRF 28 and the `slow` preset.
- `yuv420p` pixel format.
- No audio track.
- Fast-start metadata for progressive playback.

The same script will capture a representative frame at 0.5 seconds and create a
WebP poster with a maximum width of 960 px and quality 76. Posters use the
video's basename, for example `xelapps.webp` for `xelapps.mp4`.

The script will fail without replacing files when FFmpeg is unavailable, an
input cannot be decoded, or an output is empty. It will print per-file and total
sizes after successful generation. Generated MP4 and WebP files are committed
assets; site visitors do not run the optimization script.

## Loading flow

1. The browser downloads the HTML, CSS, initial application chunk, and active
   route chunk.
2. React renders the route and the CSS-backed canvas area.
3. Idle scheduling requests the deferred Three.js scene chunk.
4. The Works page renders poster-backed media with no inactive MP4 sources.
5. Native image loading and the viewport observer limit requests to media near
   the viewport.
6. Hover or focus activates a visible preview immediately.
7. Detail routes load their primary media eagerly.

## Failure behavior

- A failed dynamic import, WebGL setup, shader compile, or render hides the
  canvas and leaves the themed CSS background.
- Missing `requestIdleCallback` uses the timeout fallback.
- Missing `IntersectionObserver` leaves cards poster-backed; explicit hover or
  focus can still activate video unless reduced motion is enabled.
- A failed poster displays the existing text fallback and accessible media
  description.
- A failed video keeps the poster visible and disables further playback
  interaction.
- Media failure never disables the surrounding project link.
- Scheduled callbacks, observers, event listeners, and media references are
  released during unmount.

## Accessibility

- Existing alternative text and video labels remain.
- Keyboard focus has the same activation opportunity as pointer hover.
- Media boxes retain their fixed aspect ratio during all loading states.
- Reduced-motion users do not receive automatic background or card-preview
  animation.
- Project-detail videos remain explicitly playable in reduced-motion mode.
- Static fallback content remains usable without WebGL, video support, or
  observer APIs.

## Performance budgets

The completed build must meet all of these budgets:

- The initial JavaScript entry and its static JavaScript imports total no more
  than 120 kB gzip.
- The Three.js scene is absent from the initial static dependency graph and is
  reachable only through a dynamic chunk.
- An off-screen Works card produces no MP4 request before activation.
- Recompressed portfolio MP4 files total no more than 10 MB.
- Portfolio WebP posters total no more than 500 kB.
- Every video project references an existing poster.
- Poster-to-video activation causes no layout shift.

Vite will emit a build manifest. A Node budget script will traverse the initial
entry's static imports, gzip the corresponding build files, verify the deferred
scene boundary, validate project poster coverage, and total committed media
sizes. The normal production build will run this check so CI enforces the
budgets.

## Testing

Vitest tests will cover:

- Lazy route fallbacks and successful route rendering.
- A viewport video having no source before activation.
- Activation through observation, hover, and focus.
- Source attachment occurring at most once.
- Immediate source attachment in eager mode.
- Pause, rewind, observer disconnection, scheduler cancellation, and unmount
  cleanup.
- Poster and video error fallbacks.
- Missing observer and idle-callback fallbacks.
- Reduced-motion card behavior and static background rendering.
- Deferred scene initialization and initialization failure.
- Project data having a valid poster for every video.
- Budget-script calculations and failure conditions.

Verification will run `npm run verify`, which includes the existing test suite,
type checking, the production build, SPA fallback generation, and the new
performance-budget check.

A final browser audit will cover Home, Works, and one project-detail route. It
will verify deferred scene loading, the absence of off-screen MP4 resources,
preview activation, fallback-free rendering, responsive layout, and stable
media dimensions.

## Delivery

Implementation will be delivered as focused code, generated media, tests, and
the reproducible asset and budget scripts. Deployment remains the existing
GitHub Pages workflow and is outside the implementation step unless explicitly
requested.

## Task 6 runtime correction: initial-route readiness

The production normal-motion audit found that `BackgroundCanvas` can schedule
its idle import while the initial lazy route is still suspended. On the
observed Home load, the background scene request began before the Home heading
committed, contradicting the deferred-background requirement above.

`AppShell` will therefore provide a narrowly scoped, one-shot readiness signal
for initial background scheduling. A small wrapper inside each route's
`Suspense` content will signal from an effect after that content commits. While
the initial route remains on its fallback, `BackgroundCanvas` will not schedule
either initialization path. After the signal, it will preserve the existing
`requestIdleCallback` timeout of 1.5 seconds and the existing cancellable 250 ms
fallback for browsers without that API.

The signal does not reset during later route navigation. The shared canvas
therefore retains its identity, route transitions remain unchanged, and all
existing import, WebGL, listener, observer, failure, and disposal cleanup stays
within `BackgroundCanvas`.

A focused regression test will render `AppShell` with a deliberately suspended
initial route. It will prove that no idle callback is scheduled and no scene is
created while the fallback is visible, then resolve the route and prove that
the heading commits before the unchanged idle scheduler becomes eligible.
