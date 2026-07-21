# Cosmic Genesis WebGL Showcase Design

Date: 2026-07-21

Status: Approved for specification

## Goal

Build a standalone, full-screen Three.js showcase at `/showcase/`. The scene will combine advanced WebGL techniques in one coherent interactive artwork. It will run as an autonomous cosmic system and respond to direct manipulation without following a fixed cinematic timeline.

The piece should demonstrate GPU simulation, procedural geometry, volumetric rendering, physical materials, fluid deformation, advanced shadows, and a multi-pass HDR pipeline. Adaptive quality must preserve the composition on desktop and capable mobile devices.

## Repository Strategy

The portfolio currently uses Gatsby 2, React 16, and Three.js 0.107.0. The showcase needs current Three.js and WebGL 2 APIs, so it will live in an isolated Vite and TypeScript application inside the repository. The implementation plan will select the latest stable Three.js release available at that time and lock its exact version. The showcase will not import the portfolio's React runtime or Three.js dependency.

The showcase build will produce a self-contained bundle for `/showcase/`. Deployment glue will copy that output into the portfolio's published directory after the Gatsby build. This boundary allows the portfolio to link to or embed the showcase later without forcing a framework migration now.

## Reference Techniques

The design draws from these official Three.js examples:

| Technique | Reference | Use in this design |
| --- | --- | --- |
| GPGPU ping-pong simulation | `webgl_gpgpu_birds`, `webgl_gpgpu_water`, `webgl_gpgpu_protoplanet` | Orbital particles and membrane height field |
| Volumetric raymarching | `webgl_volume_cloud`, `webgl_volume_perlin` | Nebula density and light shafts |
| Marching Cubes | `webgl_marchingcubes` | Animated proto-star surface |
| Physical transmission | `webgl_materials_physical_transmission` | Crystal state, absorption, refraction, and dispersion |
| Screen-space rendering | `webgl_postprocessing_ssr`, `webgl_postprocessing_gtao` | Reflections and contact shading |
| Advanced soft shadows | `webgl_shadowmap_pcss` | Distance-dependent shadow softness |
| Multiple render targets | `webgl_multiple_rendertargets` | Normal and energy-mask attachments for post-processing |

The live scene excludes progressive path tracing. Camera motion and simulation changes would invalidate accumulated samples on most frames. A separate freeze-and-resolve mode may add path tracing in a later project.

Most content will come from procedural systems. The release bundle will include a small blue-noise texture, an environment map if the physical material needs one, and an optimized fallback capture. It will not include 3D model downloads.

## Experience and Composition

The visitor enters a composed three-quarter view of a cosmic system. The scene contains four visual layers:

1. An animated proto-star forms the focal point. Its Marching Cubes surface breathes, splits, reconnects, and changes between molten plasma and translucent crystal.
2. A GPGPU particle field creates orbiting dust, accretion streams, sparks, and shockwave debris.
3. Raymarched nebulae surround the core and reveal its light through cyan and violet density fields.
4. A dark reflective membrane sits beneath the core. Its fluid deformation represents distorted spacetime rather than water.

The palette uses a near-black background, cyan and violet energy, a white-gold stellar core, and restrained spectral dispersion. Bloom follows emissive energy masks so dark geometry and background details stay crisp.

The scene runs without an obvious loop. Stable seeded noise and independent simulation phases prevent synchronized resets. A small overlay contains an interaction hint, quality selection, and reset control. Sound remains outside the first release.

## Interaction Model

The scene remains active at rest. The proto-star breathes, particles orbit, the membrane undulates, and nebula density drifts.

Pointer movement projects an influence point into the orbital volume. Particles near that point receive a bounded attraction force. Pointer velocity contributes tangential force, which lets the visitor pull streams into spirals. The force decays after movement stops.

Dragging rotates the camera with damped inertia and reduces pointer gravity until the drag ends. Wheel and pinch input change camera distance within fixed limits. A short click or tap emits an energy pulse; movement beyond the drag threshold cancels that pulse.

Keyboard controls provide equivalent actions:

- Arrow keys orbit the camera.
- `+` and `-` change camera distance.
- `Space` triggers an energy pulse.
- `R` resets the camera.

A single pulse event drives each subsystem:

1. The proto-star expands and raises its crystal transmission state.
2. A spherical force ejects nearby particles.
3. A ring disturbance enters the membrane simulation.
4. Nebula density clears near the core.
5. Emissive intensity and bloom rise, then return over about three seconds.

Repeated pulses accumulate energy to a fixed ceiling. Reaching the ceiling triggers one larger release, followed by a controlled return to the resting state. The simulation clamps forces, velocities, surface displacement, exposure, and bloom intensity.

Touch input uses one-finger movement for orbital influence, drag for camera rotation, pinch for distance, and tap for a pulse. Reduced-motion mode removes camera inertia, rapid particle ejection, and high-frequency surface deformation while retaining direct controls.

## Rendering Architecture

### Application Shell

`ShowcaseApp` owns renderer creation, capability detection, resize handling, document visibility, the animation loop, context recovery, and disposal. It creates each subsystem and passes them a shared runtime context.

`InteractionController` converts pointer, touch, wheel, and keyboard events into damped camera intent, a gravitational influence point, pointer velocity, and normalized pulse events. It stores mutable input outside any UI framework state.

`QualityManager` selects the initial tier, measures frame time, applies hysteresis, and coordinates tier transitions. It exposes one immutable settings object per quality change.

### Particle Simulation

`ParticleSimulation` uses `GPUComputationRenderer` with floating-point position and velocity textures. The velocity pass combines orbital attraction, seeded curl noise, neighbor-independent turbulence, pointer gravity, pulse shockwaves, damping, and boundary recovery. The position pass integrates velocity with a capped fixed timestep.

The particle render material reads the current position texture in the vertex shader. Static buffer attributes hold seed, size, energy, color phase, and orbit class. The renderer draws the field in one points call plus an optional instanced call for bright signal particles.

Quality changes allocate a new simulation at the target resolution and seed it from the same deterministic field. A short crossfade hides the replacement. The system does not copy large buffers back to the CPU each frame.

### Proto-Star

`ProtoStar` maintains a bounded scalar field and feeds it to the Three.js Marching Cubes implementation. A small set of metaball sources follows seeded orbits and reacts to pulse energy. Quality settings control field resolution and update frequency.

The surface material extends the physical material shader. A normalized energy value controls emissive plasma, roughness, transmission, thickness, attenuation, index of refraction, and dispersion. The shader adds a thin Fresnel rim and animated internal noise without replacing the physical lighting model.

The system caps Marching Cubes work on lower tiers. Medium and low tiers update the scalar field at a lower frequency and interpolate material parameters each frame.

### Space Membrane

`SpaceMembrane` runs a second GPGPU simulation at a lower resolution. Its height and velocity textures implement damped wave propagation. Pulse events add large disturbances. The membrane compute shader samples a fixed set of texels from the particle position texture to create smaller impacts without GPU-to-CPU readback.

The vertex shader samples the height field to deform a tessellated plane. The fragment shader combines dark physical reflection, fine procedural normals, and a subtle cyan response near high curvature. SSR supplies local reflections where the quality tier permits it.

### Volumetric Nebula

`NebulaVolume` renders a depth-aware raymarch pass into a reduced-resolution target. A seeded 3D noise field combines with analytic density shapes centered around the proto-star and particle streams. Blue-noise jitter reduces banding, while temporal reprojection remains outside the first version.

The raymarcher stops against scene depth, uses adaptive empty-space steps, and clamps accumulated density. Quality tiers control target scale, maximum steps, shadow samples, and noise octaves.

### Render Pipeline

`RenderPipeline` renders the physical scene into a half-float HDR target with a depth texture. An auxiliary G-buffer pass uses multiple render targets to produce view-space normals and a selective energy mask. GTAO uses depth and normals. SSR uses depth, normals, roughness limits, and the membrane mask so it does not trace the whole frame.

Selective bloom reads the energy mask and HDR luminance. The final pass applies color grading, exposure, tone mapping, and sRGB output conversion. PCSS provides soft shadows on Ultra and High. Medium and Low use cheaper PCF shadows.

The pipeline owns all render targets and reallocates them through one debounced resize path. Each pass exposes `setSize`, `setQuality`, `render`, and `dispose` methods.

## Data Flow

`InteractionController` writes normalized input into a shared interaction snapshot. The camera controller, particle simulation, proto-star, membrane, and nebula read that snapshot during each fixed simulation step.

The update order is:

1. Sample and damp input.
2. Advance fixed simulation steps within a per-frame limit.
3. Update procedural surface and material state.
4. Render HDR color and depth.
5. Render normal and energy attachments.
6. Run GTAO, selective SSR, volumetrics, bloom, and output grading.

The UI reads quality and compatibility state at a low frequency. It does not participate in the render loop.

## Adaptive Quality

| Setting | Ultra | High | Medium | Low |
| --- | ---: | ---: | ---: | ---: |
| GPGPU particles | 384 x 384 | 256 x 256 | 192 x 192 | 128 x 128 |
| Approximate particle count | 147,456 | 65,536 | 36,864 | 16,384 |
| Membrane simulation | 256 x 256 | 192 x 192 | 128 x 128 | 96 x 96 |
| Marching Cubes resolution | 56 | 48 | 40 | 32 |
| Volumetric ray steps | 96 | 72 | 48 | 28 |
| Pixel-ratio cap | 2.0 | 1.5 | 1.25 | 1.0 |
| SSR | Half resolution | Half resolution | Quarter resolution | Off |
| GTAO | High | Medium | Low | Quarter-resolution depth-only AO |
| Shadows | PCSS high | PCSS medium | PCF | PCF |

The initial tier uses viewport size, device pixel ratio, touch capability, hardware concurrency, device memory when available, and reduced-motion preference. A calibration window starts after shader compilation and asset upload.

The manager uses a rolling frame-time percentile rather than one slow frame. It steps down after sustained performance below the tier target. It may step up once after a long stable interval. Separate thresholds and cooldown periods prevent oscillation.

The target is 60 frames per second on modern desktops and at least 30 frames per second on capable mobile devices. The user can select Auto, Ultra, High, Medium, or Low. Manual selection disables automatic tier changes but keeps fixed-timestep safety limits.

Tier changes crossfade particle density, volumetric resolution, and post effects. Simulation clocks and seeded phases continue through the transition.

## Loading, Failure Handling, and Cleanup

The application shows a lightweight CSS composition while it creates the renderer and compiles shaders. `compileAsync` prepares scene programs where the browser supports parallel shader compilation.

WebGL 2 support is mandatory. The release bundle includes an optimized still captured from the approved composition. Unsupported devices retain that image with a compatibility notice. Shader compilation or render-target allocation failure triggers the same fallback.

The application pauses animation and simulation clocks while the document is hidden. It caps elapsed time after resume. A debounced resize path ignores zero-sized canvases and delays expensive target allocation until dimensions settle.

Context loss stops the loop and marks GPU resources invalid. The application attempts one clean reconstruction after context restoration. A second failure keeps the static fallback.

Disposal removes input and visibility listeners, cancels frame callbacks, and disposes simulations, render targets, textures, geometries, materials, passes, and the renderer. Each subsystem accepts repeated disposal calls without throwing.

## Testing and Verification

Unit tests will cover:

- Deterministic seeded particle and field initialization
- Pointer-force and pulse falloff bounds
- Fixed-step accumulation and maximum-step limits
- Energy ceiling and release behavior
- Click-versus-drag recognition for pointer and touch input
- Quality selection, hysteresis, cooldown, and manual override
- Tier parameter completeness
- Resize guards, visibility pause, context state, and repeated disposal

Browser smoke tests will compile all shader variants and load the application from the `/showcase/` base path. Seeded frame captures will check the resting composition, pointer disturbance, pulse peak, reduced-motion mode, and each quality tier. The captures should detect missing layers, black frames, broken compositing, and large composition changes. They will use tolerant comparisons because GPU output varies across vendors.

Manual checks will cover current Chrome, Edge, Firefox, and Safari where available. Device checks will include desktop pointer input, a touch viewport, reduced motion, quality transitions, context loss, and navigation away from the showcase. Performance measurement begins after shader warm-up.

## Acceptance Criteria

- The full-screen scene integrates GPGPU particles, a Marching Cubes proto-star, physical transmission, a GPGPU membrane, volumetric raymarching, soft shadows, GTAO, selective SSR, and selective bloom.
- The scene responds to pointer gravity, camera drag, zoom, keyboard control, and pulse input within the next rendered frame.
- The simulation returns to a stable autonomous state after interaction.
- A modern desktop sustains about 60 frames per second at the automatically selected tier after warm-up.
- Capable mobile devices sustain at least 30 frames per second at the selected tier.
- Quality changes preserve camera state, simulation time, and visual continuity.
- Reduced-motion mode and keyboard controls remain usable.
- Unsupported hardware, shader errors, allocation failure, and repeated context loss leave a static composition instead of a blank page.
- Leaving or reloading the page releases GPU resources and event listeners.
- The showcase build deploys at `/showcase/` without changing the portfolio runtime.

## Scope Limits

The first release excludes audio, WebXR, live path tracing, imported 3D models, a public parameter laboratory, backend services, analytics, and portfolio navigation changes. It includes the standalone application, adaptive render systems, minimal controls, tests, build integration, and static fallback.
