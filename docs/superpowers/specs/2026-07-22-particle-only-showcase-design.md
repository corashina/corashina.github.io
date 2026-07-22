# Particle-Only Showcase Design

Date: 2026-07-22

Status: Approved for specification

## Goal

Refocus the standalone Three.js showcase on its GPGPU particle simulation. The revised scene must remove the central proto-star, reflective membrane, volumetric nebula, lighting-driven geometry, and quality selection while retaining the existing particle interaction model.

The result should be a clean full-screen particle field with a dark spatial background, fixed low-cost rendering, and no visible non-particle scene elements.

This document supersedes the composition, rendering architecture, adaptive-quality, and acceptance-criteria sections of the original Cosmic Genesis showcase design where they conflict with the particle-only direction.

## Experience and Composition

Particles are the only visible simulated content. The opening view presents the existing cyan, violet, and warm particle field across a near-black background. There is no central blob, ground plane, water surface, reflected image, fog volume, or other focal object.

The camera continues to frame the field in three dimensions. Particle depth, motion, color, point size, additive blending, and restrained glow provide the visual hierarchy that was previously supplied by the removed systems.

The overlay contains only a concise interaction hint and the existing Reset View control. The quality selector and all quality labels are removed.

## Interaction Model

The current particle interactions remain intact:

- Pointer movement attracts nearby particles and can pull streams into curved paths.
- Pointer velocity contributes tangential force.
- Dragging orbits the camera with damped motion.
- Wheel and pinch input change camera distance within the existing limits.
- A short click, tap, or `Space` emits a particle shockwave pulse.
- Keyboard camera controls and `R` to reset remain available.
- Reset View restores the initial camera framing.

Removed subsystems no longer receive or react to pulse energy. A pulse affects only the particle velocity simulation and any particle-specific visual intensity already derived from that event.

## Runtime Architecture

`ShowcaseApp` retains renderer setup, capability checks, the animation loop, resize handling, context recovery, interaction sampling, camera control, and disposal. Its scene ownership is reduced to the camera and `ParticleSimulation`.

The following runtime systems are removed from application construction, per-frame updates, quality changes, rendering, and disposal:

- `ProtoStar`
- `SpaceMembrane`
- `NebulaPass`
- Scene lights and shadow configuration
- Auxiliary normal, roughness, depth, and reflection buffers
- GTAO and SSR passes
- PCSS configuration

Modules may be deleted when they have no remaining consumers. If shared types are still used by the particle system, they should be narrowed rather than retaining inactive runtime branches.

## Fixed Quality

The showcase always uses the existing Low particle profile:

- Simulation texture: 128 x 128
- Particle count: 16,384
- Device pixel-ratio cap: 1.0

The `QualityManager`, adaptive sampling, tier transitions, manual overrides, and quality-selector event handling are removed from the active application. There is no runtime quality option.

Particle initialization receives the fixed settings directly. Transition logic that exists solely to crossfade between particle resolutions should be removed or bypassed if it no longer serves another purpose.

## Rendering Pipeline

The renderer uses a minimal particle pipeline:

1. Clear to the existing dark spatial background.
2. Render the particle scene into the composer or a simple HDR target.
3. Apply restrained bloom to luminous particle pixels only.
4. Apply output tone mapping and sRGB conversion.

Bloom remains because it is a presentation treatment for the particles rather than a separate scene layer. It must not create a broad haze or reconstruct the appearance of the removed nebula. If the current selective bloom depends on auxiliary geometry buffers, replace it with a simpler luminance-threshold bloom or a particle-only mask.

The final pipeline must not allocate or execute reflection, ambient-occlusion, membrane, volumetric, shadow, or geometry-mask passes.

## Interface and Accessibility

The quality selector is removed from the HTML and its CSS is cleaned up. The interaction hint is updated to describe drag, zoom, and click/tap pulse controls. Reset View remains keyboard- and pointer-accessible.

Reduced-motion handling continues to limit camera inertia and abrupt particle motion without introducing a second visible quality mode. Unsupported WebGL 2 devices retain the current fallback behavior.

## Error Handling and Cleanup

Renderer creation, shader compilation, context loss, resize guards, visibility pause, and fallback handling remain. Cleanup must dispose the particle compute resources, particle material and geometry, the simplified render pipeline, renderer, and input listeners. Disposal must remain safe when initialization only partially completes.

Removed systems must leave no animation-loop calls, resize calls, event handlers, render targets, or disposal branches behind.

## Testing and Verification

Unit tests will cover:

- Fixed Low particle settings and the absence of runtime tier selection
- Particle initialization, stepping, pointer force, pulse force, and disposal
- Construction of the simplified particle-only render pipeline
- Absence of GTAO, SSR, volumetric, membrane, and shadow passes
- Application resize, visibility, context handling, and repeated cleanup
- Updated overlay controls and interaction hint

Browser verification will confirm that `/showcase/` renders visible particles instead of a white or black frame, contains no blob or plane, exposes no quality selector, and preserves drag, zoom, pulse, keyboard, and Reset View behavior.

Type checking, unit tests, production build, and a browser smoke test must pass before completion is claimed.

## Acceptance Criteria

- Low is the fixed and only runtime quality configuration.
- No quality selector or adaptive-quality behavior remains in the running showcase.
- The proto-star/blob is not constructed or rendered.
- The membrane/water plane and its reflections are not constructed or rendered.
- Nebula, GTAO, SSR, shadows, and lighting-driven scene content are not executed.
- Particles are the only visible simulated scene content.
- Subtle particle glow remains without producing a large volumetric veil.
- Drag, zoom, click/tap pulse, keyboard controls, and Reset View continue to work.
- The showcase renders correctly at `/showcase/` and releases its GPU resources on disposal.

## Scope Limits

This change does not redesign the particle shader, introduce new particle behaviors, add audio, add new content, or change portfolio navigation. It is a focused simplification of the existing showcase around the current particle simulation.
