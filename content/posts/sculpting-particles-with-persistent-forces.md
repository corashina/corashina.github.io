---
title: "Sculpting particles with forces that outlast the gesture"
description: "GPU simulation, persistent deformation fields, and touch controls for an interactive particle sculpture."
date: "2026-07-28"
tags: [WebGL, GLSL, TypeScript, Interaction]
draft: false
---

In Cosmic Sugar, holding the pointer pushes a cavity into a cloud of particles. Pulling gathers particles around the selected point. Releasing the pointer leaves a force field in place, so the cloud keeps moving around the shape you made.

That interaction needs more state than a pointer position and a mouse-button flag. A temporary force must become a persistent deformation once, at the end of a valid gesture. A pinch must move the camera without leaving a dent. Losing the WebGL context must not erase the user's collection of forces.

The simulation uses Three.js and GLSL, with 16,384 particles arranged in 128 by 128 state textures. This retrospective follows the version completed on 28 July 2026, including its two autonomous moving fields.

## Keeping particle state on the GPU

I use `GPUComputationRenderer` to update position and velocity textures. Each texel represents one particle. The position and velocity variables both depend on the previous position and velocity, allowing the compute passes to read one state while writing the next.

The visible geometry contains texture lookup coordinates. Its vertex shader samples the computed position texture instead of receiving a new CPU position array each frame. After a compute step, the simulation binds the current position render target to the point material.

This division keeps per-particle integration on the GPU. The CPU manages a much smaller description of the world: pointer input, deformation stamps, scene parameters, and autonomous entity positions. It uploads those values through reusable uniform containers.

The force shader combines local attraction and repulsion with tangential motion, turbulence, and damping. It bounds force magnitudes and velocity, and protects normalization near zero-length vectors. Those details matter around the centre of a pull, where the direction vector can disappear while the force remains active. See the [simulation](https://github.com/corashina/cosmic-sugar/blob/79f8bdaeb160bf392ac61eee51ea81b9b9bca73b/src/particles/ParticleSimulation.ts) and [shaders](https://github.com/corashina/cosmic-sugar/blob/79f8bdaeb160bf392ac61eee51ea81b9b9bca73b/src/particles/particleShaders.ts).

## Representing a sculpture as a bounded set of forces

Saving every pointer sample would make the cost of the scene grow with the time spent drawing. I store at most 12 deformation stamps. A stamp records its centre, radius, strength, and push or pull direction.

During a hold, the simulation receives a provisional stamp. On release, the deformation store processes the gesture's commit identifier and incorporates the stamp into persistent state. Repeated delivery of an already processed identifier cannot add the same force again.

Overlapping stamps in the same direction merge. Their strengths determine the merged centre, while radius and strength stay within limits. An opposite force erodes existing stamps before contributing any remaining strength of its own.

Erosion has a budget. If one new stamp overlaps several old ones, subtracting its full strength from each would amplify the gesture. The store calculates the total requested erosion and scales it down when it exceeds the incoming strength. At capacity, compatible overflow merges into the nearest stamp of the same direction.

The approximation trades spatial detail for a fixed shader workload. A long session can change an existing field's centre instead of adding another independent field. The [deformation store](https://github.com/corashina/cosmic-sugar/blob/79f8bdaeb160bf392ac61eee51ea81b9b9bca73b/src/particles/DeformationStore.ts) makes that policy explicit.

## Deciding whether a touch means push, orbit, or pinch

A stationary finger and a dragging finger begin with the same event. Two fingers can mean either a pull or a zoom. I handle those ambiguities in an interaction controller before producing a simulation force.

The controller classifies gestures and keeps the classification stable as input changes. Cancellation, loss of focus, and interrupted multi-touch sequences do not count as completed sculpting gestures. A two-finger pull also needs care during release: one finger can leave before the other, creating an intermediate state that must not become a new one-finger push.

The frame path has a clear order:

```text
Sample the input state
    -> project the force target into world coordinates
    -> update committed and provisional deformations
    -> update the camera and simulation
    -> render the current particle texture
```

The interaction tests cover those transitions, including interrupted releases and commits emitted once. Testing only the final image would miss a force accidentally committed between two touch events.

## Bounding time and recovering resources

Physics advances in steps of 1/60 second, with at most four steps per frame. The clock caps elapsed time and drops excess backlog after reaching that limit. Hiding the page pauses the loop; returning to it does not replay the entire hidden interval.

Persistent deformation data lives outside the GPU resource layer. After the first context restoration, the application recreates compute targets, materials, and rendering systems, then uploads the stored forces before rendering. Particle trajectories restart from seeded state; the sculpture's force description survives. A second context loss switches to fallback artwork.

The repository includes tests for resource disposal, gesture transitions, and restoring uniforms before the first recovered render. These tests target the boundaries between input, saved state, and rendering. They do not establish a frame-rate guarantee across devices.

The [application coordinator](https://github.com/corashina/cosmic-sugar/blob/79f8bdaeb160bf392ac61eee51ea81b9b9bca73b/src/app/ShowcaseApp.ts) keeps that lifecycle separate from the force equations. I can change the appearance of a pull without changing what counts as a completed gesture or what survives a renderer restart.
