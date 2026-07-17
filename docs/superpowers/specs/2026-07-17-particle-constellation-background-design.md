# Particle Constellation Background Design

Date: 2026-07-17

## Goal

Replace the portfolio's layered wireframe terrain with a dense monochrome particle constellation. The scene should demonstrate advanced WebGL work while preserving page readability, responsive behavior, theme support, and accessibility.

## Selected Direction

The selected direction is Constellation Engine. Thousands of particles drift through coordinated currents and form temporary clusters. Nearby nodes reveal crisp links. A smaller set of signal nodes adds halos, pulses, and short trails.

The design remains monochrome in both themes. Depth, motion, scale, opacity, and glow provide the visual range. The scene acts as a prominent portfolio feature on desktop and reduces its intensity on smaller or slower devices.

Two other directions informed the choice:

- Luminous Current emphasized flowing trails and cinematic waves, but weakened the network structure.
- Emergent Signal mixed currents with constellations, but produced a less legible visual identity.

Constellation Engine gives the portfolio a technical character and supports the requested node density.

## Visual Behavior

The scene contains two particle populations:

- 6,000 to 10,000 ambient particles create depth, clusters, and fine motion.
- 64 to 128 signal nodes provide brighter focal points, larger halos, pulses, and longer trails.

Layered curl noise moves the field in slow waves. Stable per-particle seeds control cluster membership, depth, phase, and energy. Clusters migrate, expand, contract, dissolve, and reconnect without visible resets.

A bounded connection graph links selected nearby particles. The shader fades links by distance, depth, cluster phase, and signal activity. Signal pulses travel through local links and raise their brightness for short intervals.

The central content region uses a soft density and luminance mask. The mask protects text contrast without creating a visible rectangular gap. Theme-specific tuning keeps the dark scene luminous and the light scene precise.

## Pointer and Device Interaction

Pointer movement creates a soft influence well around the cursor. Nearby particles bend toward the pointer path and sweep around it. Pointer speed controls trail length and connection energy within fixed limits. The field returns to autonomous motion after inactivity.

The scene tracks pointer values outside React state and sends normalized position, velocity, and activity to shader uniforms. Damping removes jumps and preserves continuity.

Touch devices use autonomous drift. Reduced-motion users receive one composed static constellation with no pointer response.

## Rendering Architecture

The ambient field uses one `THREE.Points` object backed by `BufferGeometry` and custom shaders. Static attributes store each particle's seed, cluster, phase, size, and depth. The vertex shader calculates movement, perspective size, content masking, and pointer influence on the GPU.

Signal nodes use instanced camera-facing quads. One instanced draw call supplies halo size, pulse phase, energy, and trail orientation. The fragment shader creates soft monochrome halos without a post-processing bloom pass.

Connections use a separate batched line geometry. Initialization builds a bounded candidate graph from cluster-local neighbors. Shaders animate line visibility and signal propagation. This design avoids an all-pairs distance search and keeps draw calls stable as density rises.

The renderer caps device pixel ratio. The animation loop updates time, pointer, theme, viewport, and quality uniforms. Particle positions require no per-frame CPU buffer writes.

## Module Boundaries

`BackgroundCanvas.tsx` owns React integration:

- Canvas creation and failure visibility
- Resize observation
- Pointer and document visibility listeners
- Theme and reduced-motion integration
- Controller creation and cleanup

`backgroundScene.ts` owns the Three.js lifecycle:

- Renderer, scene, and camera setup
- Animation timing and pause behavior
- Theme interpolation
- Quality selection and resize handling
- WebGL context loss and disposal

`particleField.ts` owns particle data and render objects:

- Seeded attribute generation
- Ambient point geometry
- Signal-node instances
- Bounded connection geometry
- Materials and resource disposal

`particleShaders.ts` owns shader source for ambient points, signal nodes, halos, trails, and connections.

The existing `BackgroundController` interface remains the boundary between React and Three.js unless implementation tests reveal a need for one additional quality-reporting method.

## Quality Scaling

The scene supports three quality tiers. Viewport size, device pixel ratio, and coarse device capability choose the initial tier.

| Tier | Ambient particles | Signal nodes | Connection budget |
| --- | ---: | ---: | ---: |
| High | 10,000 | 128 | 3,200 |
| Medium | 6,000 | 80 | 1,800 |
| Low | 3,000 | 48 | 900 |

The controller samples sustained frame time after startup. It may step down one tier after a slow-frame window. The transition fades particle and link density to avoid a visible pop. The controller does not step up during the same page session.

Reduced motion bypasses adaptive sampling and renders a static medium-density composition. Hidden documents stop the animation clock and frame requests.

## Theme and Presentation

Dark mode uses a near-black clear color with gray-white nodes and restrained additive glow. Light mode uses a white clear color with gray nodes, darker links, and lower halo opacity. Theme changes interpolate colors and luminance over several frames.

The canvas remains decorative, fixed, and excluded from pointer hit testing. CSS controls its final compositing opacity. Page content and controls stay above it.

## Failure Handling and Cleanup

The scene preflights shader compilation. Renderer creation, compilation, or render errors trigger the existing failure callback. `BackgroundCanvas` then hides the canvas and leaves the CSS theme background visible.

WebGL context loss stops rendering and reports one failure. Disposal cancels the animation frame and removes listeners. It also disposes point geometry, instance geometry, line geometry, shader materials, and the renderer once.

Resize handling clamps zero dimensions to one pixel before updating the renderer and camera. The controller caps elapsed-frame deltas so a resumed tab cannot cause a motion jump.

## Testing

Automated tests will cover:

- Deterministic particle attributes for a fixed seed
- Quality-tier selection and density budgets
- Connection graph bounds and index validity
- Pixel-ratio and zero-size guards
- Pointer normalization, damping, and uniform updates
- Theme interpolation
- Reduced-motion static rendering
- Pause, resume, render failure, context loss, and one-time disposal
- React integration for listeners, resize, themes, visibility, and fallback behavior
- Type checking, the full test suite, and the production build

Manual checks will cover both themes, common desktop and mobile sizes, text readability, cursor response, reduced motion, and sustained frame rate. The review should include pages with short and long content.

## Acceptance Criteria

- A modern desktop renders a dense field with up to 10,000 ambient particles and 128 signal nodes.
- Particles form recognizable temporary clusters with bounded links, pulses, and short trails.
- Pointer movement bends the local field and raises signal energy without abrupt motion.
- The central content region remains readable on each route and in both themes.
- Mobile and slower devices receive a lower quality tier.
- Reduced motion produces a static composition and disables pointer response.
- Hidden tabs stop frame requests and preserve elapsed animation time.
- WebGL failures leave the application functional with its CSS background.
- Tests, type checking, and the production build pass.

## Scope Limits

This change replaces the background scene and its supporting shaders, tests, and presentation values. It does not change portfolio content, routing, navigation, typography, project media, or the site color palette.
