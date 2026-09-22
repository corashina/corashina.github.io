---
title: "Building Don't Sleep With the Fishes"
description: "The engineering behind a Three.js survival game: moving-ship physics, shared ocean waves, deterministic rules, and scene preparation."
date: "2026-06-22"
tags: [Game development, TypeScript, Three.js]
draft: false
---

I built Don't Sleep With the Fishes as a desktop-browser survival game. You have one minute to collect supplies from a sinking ship and reach its lifeboat. The supplies you save determine your options at sea: fish, repair the hull, spend equipment on an encounter, or wait through another night.

The game uses TypeScript, Three.js, and custom GLSL shaders. Rapier handles the movable obstacles aboard the ship. Vite builds the application for static hosting; the survival rules run in TypeScript without a WebGL renderer.

Several problems cross those boundaries. The boat needs to follow the water that the shader draws. Loose objects need to move on a tilting deck while the player walks in ship coordinates. An event can consume an item before its animation has finished showing that item. Restarting during a model load must prevent the old scene from appearing afterward.

## Separating the rules from the scene

The opening scavenging sequence and the lifeboat sequence need different controls and different clocks. On the ship, you move in first person against a running deadline. In the lifeboat, you spend actions and advance through days and events. I keep those sequences in separate phases under one game director.

The main boundaries are:

| Component | Responsibility |
| --- | --- |
| `Game` | Renderer lifetime, phase transitions, restart, and loading cover |
| `PhaseResources` | Shared asset loads and resource leases |
| `ScavengePhase` | Ship movement, collection, countdown, and evacuation |
| `SurvivalSession` | Resources, inventory, event resolution, and run history |
| Survival flows | Coordinate accepted actions with UI, audio, and animation |
| `BoatWorld` | Lifeboat scene, camera, weather, and frame updates |

An action travels through the survival code along this path:

```text
Player input
    -> action flow
    -> SurvivalSession validates and resolves the action
    -> outcome and updated snapshot
    -> flow coordinates scene, sound, and UI
```

`SurvivalSession` owns mutable game state. Event selection and resource rules sit in focused modules around it. The scene consumes snapshots and outcomes, which lets me exercise a survival run without loading models or creating a canvas.

The separation has a practical limit. `SurvivalEventFlow` still coordinates many encounter-specific sequences, and it is a large file. Separating state from rendering makes the rules testable; it does not remove the work of coordinating cameras, item use, event exits, and cleanup. The [director](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/Game.ts) and [session](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/survival/SurvivalSession.ts) show that division.

## Making the boat follow the rendered ocean

A boat that bobs on a separate sine curve can cut through a wave or float above it. I use one four-wave field for the ocean's displacement parameters and the CPU samples that drive buoyancy.

Each wave has a direction, amplitude, wavelength, speed, steepness, and phase. The CPU sampler adds its vertical and horizontal displacement to the other waves. The renderer receives the same wave parameters as uniforms. Weather changes the amplitude scale, and a vortex can add a local depression and sideways displacement.

For the lifeboat pose, I sample heights at the bow, stern, port, and starboard. The calculation reduces to:

```text
height = average(bow, stern, port, starboard)
pitch  = atan2(bow - stern, boat length)
roll   = atan2(port - starboard, boat width)
```

The boat moves toward that target with exponential damping. The blend factor is `1 - exp(-damping * dt)`, so the smoothing accounts for elapsed time. Reusable sample objects keep this frame path from creating a new set of vectors on each update.

This is a sampled pose model. It does not solve the hull's displaced volume, water pressure, or fluid forces. Four samples give the lifeboat a useful response to the visible sea at a small CPU cost. You can inspect the [wave sampler](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/ocean/WaveField.ts) and [buoyancy calculation](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/ocean/BoatBuoyancy.ts) without reading the renderer.

Matching motion leaves another problem: ocean triangles still pass through the vessel. The water shader needs to cut out the interior as the hull translates and rotates.

I describe each exclusion region in vessel-local coordinates. Each frame supplies the inverse world transform and hull bounds. The fragment shader transforms the displaced water position into that coordinate system, tests it against a tapered hull profile, and discards fragments inside the region. The mask follows the vessel's full transform, including its parent rig and scale. Waves remain visible outside the hull.

The [exclusion data](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/ocean/WaterExclusion.ts) includes upper and lower bounds so the cutout can change with height. A rectangular hole would expose gaps around the narrower parts of the boat.

## Paying for reflections without changing the simulation

Low and High water share the wave geometry. High adds scene captures for refraction and planar reflection. I can reduce the shading cost without changing the sea motion that gameplay uses.

During a capture, the renderer hides the water and draws scene color and depth. A Three.js `Reflector` supplies the reflected view. Both captures run at up to half the source resolution, with a 1,024-pixel cap on each axis.

Depth helps reject refracted samples that belong to foreground objects. Without that check, distortion can smear an object in front of the water into the water's color. The shader uses underwater distance for color absorption, Fresnel for reflection strength, and a GGX highlight for the sun.

Rendering into extra targets also changes shared renderer state. `OceanCapture` restores the target, viewport, scissor settings, and shadow-update state in a `finally` block. Otherwise a capture failure could leave the main frame drawing with the wrong settings.

Planar reflection has a visible approximation: the reflected camera uses the sea's mean plane. Distorting the sampled reflection with the wave normal does not create a separate reflected view for each wave slope. That compromise keeps the capture manageable. The [capture code](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/ocean/OceanCapture.ts) and [optical shader](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/ocean/oceanOptics.ts) make the cost and approximation explicit.

## Walking on a ship that moves beneath loose objects

The ship's rooms and walking routes use local coordinates. Rapier simulates loose obstacles in world coordinates under gravity. I represent the deck and ship colliders with a position-based kinematic body, then feed it the ship's animated pose.

Physics advances in fixed steps of `1 / 60` second, with a maximum of three substeps per update. If a frame accumulates more work than that, the clock drops the backlog. This bounds the catch-up cost after a stall, at the expense of simulating all elapsed time.

Within the accepted substeps, I interpolate the ship position and normalized quaternion between its previous and target poses. Each substep supplies the next kinematic pose before stepping Rapier. After the substeps, I copy the obstacle poses for rendering.

Player contact crosses the coordinate boundary twice. The controller transforms the current and desired positions from ship space into world space, asks Rapier's character controller to resolve movement against dynamic obstacles, and transforms the result back. The character controller can apply impulses to those bodies, so contact can push an obstacle.

Inactive updates need their own handling. The ship can move during an introduction while physics gameplay is inactive. The inactive path carries the obstacles with the ship, clears their velocities, and resets the step clock. That prevents accumulated motion from producing an impulse spike at the handoff.

The [physics tests](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/tests/ScavengePhysics.test.ts) exercise contact pushing, tilt, containment under the game's wave field, and the inactive-to-active transition. These checks cover relationships that a screenshot cannot establish.

## Resolving an event while its animation is still running

Equipment has explicit conditions: usable, broken, consumed, or lost. Those conditions affect which actions the player can take and which props belong on the boat. They also create a timing problem during an encounter.

Suppose the player throws a supply at a threat. Updating the boat's displayed inventory at the moment of logical consumption can remove the prop before its throw finishes. Delaying the logical result until an animation callback would make that result depend on a presentation completing.

The event flow keeps a snapshot from before resolution for deferred presentation synchronization. It resolves the action in `SurvivalSession`, then coordinates the outcome animation and the point at which the scene catches up with the new state. The rules and the displayed inventory can occupy different points in that sequence for a controlled interval.

An asynchronous continuation also checks whether it still belongs to the current lifecycle and operation. A restart or replacement invalidates older work. Event bundles have a similar generation check: a late load can be disposed without attaching its scene roots.

Fishing uses an attempt identity and a settlement guard. The flow accepts the result once, updates the session, and starts the result presentation. After awaiting the animation, it checks the attempt and lifecycle again before showing the result UI.

These guards handle ordinary interactions such as leaving, restarting, or changing visibility while presentation work is pending. The relevant code sits in [event flow](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/survival/SurvivalEventFlow.ts), [fishing flow](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/survival/SurvivalFishingFlow.ts), and the [bundle manager](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/survival/EventBundleManager.ts).

## Preparing a scene beyond downloading its models

A downloaded model can still cost time on its first visible frame. The browser needs to upload textures, compile shader programs, and prepare the rendering passes.

I keep a loading cover over scene preparation. `prepareScene` walks scene materials and model templates, collects textures, uploads them through `initTexture`, and awaits `compileAsync`. It yields after each batch of eight texture uploads so the loading screen can remain responsive. Hidden templates take part in preparation because an event can reveal them later.

`PhaseResources` shares pending loads and retains loaded assets until game disposal. A phase holds leases while it uses those assets; releasing a phase lease does not evict the resident asset. Scene instances dispose their own objects before releasing the backing lease.

That policy trades session memory and initial preparation time for reuse. The menu starts with its own assets. Entering gameplay prepares a broader set, including survival content. Returning to an event can reuse prepared models, while direct survival entry can skip ship furniture and physics.

Cancellation needs to cover preparation as well as downloading. The director serializes phase preparation, checks its generation before activation, and delays renderer disposal until pending preparation finishes. The [resource owner](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/app/PhaseResources.ts) and [preparation helper](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/rendering/prepareScene.ts) implement those lifetimes.

## Testing geometry and survival runs

Some visual errors are geometric constraints. A fish should fit inside the net throughout its haul animation. Shrinking it on entry would hide the collision by changing its size.

`NetCatchPlacement` measures the basket mesh and builds a convex hull. For each hull face, it computes the furthest catch vertex along that face's normal. Those distances constrain the allowed vertical offset. It places the catch at a valid offset or rejects a model that cannot fit. The basket hull is cached, and placement runs when loading a catch.

The [containment test](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/tests/NetCatchContainment.test.ts) loads production models, samples several haul poses, and checks that the catch keeps its scale and stays within the basket bounds. At the final pose it also checks triangle intersections with the net mesh. Using the actual GLB geometry catches errors that a mock bounding box could miss.

For survival balance, I run the same `SurvivalSession` with scripted decisions. The game uses a seeded Mulberry32 generator. The simulation gives its decision policy a separate random stream, so simulated fishing reactions do not consume the game's random draws. A stalled day raises an error with the current state and pending event.

One saved report covers 1,000 sampled loadouts and 10,000 seed runs, each pairing signal-enabled and signal-disabled sessions: 20,000 sessions in total. The signal-enabled cohort had a mean rescue day of 35.063 and an 84.8% rescue rate. The disabled cohort had a mean of 40.129 and an 85.5% rescue rate. In that experiment, pursuing signals shortened the wait without increasing the rescue rate.

Those figures describe the simulation policy and the code used for that report. They do not measure human play or guarantee the same balance after rule changes. The [simulation implementation](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/src/survival/balanceSimulation.ts) and [saved report](https://github.com/corashina/dont-sleep-with-the-fishes/blob/af3b1ce6d77c7f0a3ce35752709c3da0b04eeb58/docs/scenario-simulation.md) make that distinction inspectable.

I use these checks alongside browser playtests. A simulation can expose a stalled event; a geometry test can expose an intersecting catch. Playing the scene is still necessary to judge whether you can read a threat, find an interaction, or understand the result before the next animation begins.
