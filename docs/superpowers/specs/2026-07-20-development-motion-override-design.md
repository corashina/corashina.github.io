# Development Motion Override Design

## Goal

Allow the interactive particle background to be tested locally when the browser reports `prefers-reduced-motion: reduce`, without weakening the production accessibility behavior.

## Selected Approach

The local preview accepts the URL query parameter `motion=full`. The override is active only when both conditions are true:

- Vite is running in development mode through `import.meta.env.DEV`.
- `window.location.search` contains `motion=full`.

Every production build continues to use the browser's reduced-motion preference exclusively. The override creates no visible controls and stores no state.

## Architecture and Data Flow

`BackgroundCanvas` determines whether reduced motion applies when its effect initializes. A small exported helper receives the browser preference, the development flag, and the query string. It returns `false` only for the exact development override; otherwise it returns the original browser preference.

The component uses the resolved value everywhere it currently uses reduced motion: static quality selection, animation startup, pointer handling, visibility changes, resize rendering, and theme updates. No Three.js controller or shader interface changes are required.

The live testing URL is:

`http://localhost:5174/?motion=full`

## Edge Cases

- `motion=full` in a production build has no effect.
- Similar values such as `motion=true` or `motion=FULL` have no effect.
- Missing `window.matchMedia` retains the existing default of full motion.
- Other query parameters remain untouched.
- Removing the parameter and reloading restores the browser preference.

## Testing

Unit tests cover the decision helper directly:

- Reduced motion remains enabled without the query parameter.
- Development plus `motion=full` disables reduced motion.
- Production plus `motion=full` still enables reduced motion.
- Non-exact parameter values do not enable the override.

A component regression test verifies that a reduced-motion browser starts the animation and accepts pointer updates when the development override is active. Existing reduced-motion tests continue proving that the default path renders a static medium-density composition.

## Error Handling and Scope

`URLSearchParams` handles malformed or unrelated query strings without throwing. The change is confined to `BackgroundCanvas` and its tests. It adds no dependency, visible UI, persistence, production flag, or runtime controller surface.

## Acceptance Criteria

- The reviewed local preview animates at `?motion=full` even when the browser prefers reduced motion.
- The same preview remains static without the parameter.
- Production builds always respect the browser preference.
- Existing particle, lifecycle, accessibility, and reduced-motion tests remain green.
