---
title: "Animating particles from their birth time in GLSL"
description: "A fixed particle pool, timestamp-based motion, and the boundary between CPU spawning and GPU rendering."
date: "2019-03-20"
tags: [GLSL, Three.js, TypeScript]
draft: false
---

My 2019 Particle Simulation experiment uses a fixed pool of 10,000 points. JavaScript chooses the properties of newly spawned particles. A vertex shader calculates where each particle should appear from its starting position, velocity, and age.

That design avoids integrating every particle position in a CPU loop. It suits motion that can be calculated from initial conditions and elapsed time. The experiment does not maintain a feedback simulation in textures; each vertex invocation reconstructs its position from attributes and the current time.

Development ran from February to March 2019. The date on this article follows the last implementation commit, 20 March.

## Allocating the pool before spawning

The engine allocates typed arrays for starting position, start time, velocity, colour, size, and lifetime. These become attributes of one `BufferGeometry`, rendered through one Three.js `Points` object and a shader material.

Spawning writes into the next slot. After the cursor reaches the pool's capacity, it wraps to zero and overwrites older particle data. The system reuses storage rather than creating a scene object for each birth.

The fixed capacity makes memory use predictable. It also defines an overwrite policy: sufficiently high emission can replace a particle before its intended lifetime has ended. Pool size, emission rate, and lifetime are related parameters, even though this experiment keeps their configuration small.

The [particle engine](https://github.com/corashina/Particle-Simulation/blob/bc3b562c5aabf5cfffbc4104dfbe2c30db9a8048/src/ParticleEngine.ts) shows the allocation and wraparound logic.

## Reconstructing position from age

The renderer passes one time uniform to the shader. Each particle subtracts its own birth time:

```glsl
float timeElapsed = uTime - startTime;
lifeLeft = 1.0 - (timeElapsed / life);
```

The shader then derives a velocity from the stored attributes and calculates displacement from elapsed time. The central relationship is the familiar linear-motion equation:

```text
position = starting position + velocity * age
```

The implementation adds a small interpolation-based drift and uses remaining lifetime to scale the point size. All particles receive the same current time, but their different birth times place them at different stages of their lives.

This is a useful model for sparks, streaks, and other effects whose motion has a direct expression. Interactions that depend on accumulated state, such as collisions or changing neighbour forces, need another representation. Reconstructing a trajectory from birth data does not retain the results of an earlier collision.

The [vertex shader](https://github.com/corashina/Particle-Simulation/blob/bc3b562c5aabf5cfffbc4104dfbe2c30db9a8048/src/VertexShader.ts) contains the complete calculation, including its experimental velocity filters.

## Rendering a point as a sprite

A point primitive becomes a small screen-aligned area. The fragment shader samples a sprite texture using `gl_PointCoord` and combines the texture's alpha mask with the particle colour. Additive blending allows overlapping points to become brighter.

That produces a luminous effect with little geometry. It also couples appearance to overlap: increasing the number of visible particles changes brightness, even if the individual colours remain the same.

The archived shader calculates a fade value from lifetime but does not use that value in the final colour. Its output alpha is fixed at one, while the texture alpha affects RGB. The vertex shader shrinks the point with remaining life, but does not provide a complete explicit rejection path for expired particles.

Those details prevent a stronger claim about smooth lifetime fading. A revision should define how unborn, live, and expired particles contribute to the frame, then use that rule in both point size and fragment output. The [fragment shader](https://github.com/corashina/Particle-Simulation/blob/bc3b562c5aabf5cfffbc4104dfbe2c30db9a8048/src/FragmentShader.ts) makes the unfinished path visible.

## Accounting for the work left on the CPU

Moving position calculations into GLSL does not eliminate uploads. The update method marks six attribute buffers as changed each frame. That can transfer more data than the handful of slots written by the latest spawn calls.

A more selective implementation would track the changed ranges, taking care when the spawn cursor wraps around the end of the pool. It would also distinguish attributes that change at birth from values that change each frame.

The emission loop has another small timing issue. It compares an integer loop counter against `1000 * delta`. A fractional target can therefore emit a whole extra particle. Carrying a fractional emission remainder between frames would preserve the intended average rate without making births depend on that rounding.

Neither point requires abandoning the design. Both follow from checking the entire path from frame time to buffer writes, rather than considering shader arithmetic in isolation.

## A small renderer with explicit limits

The project includes resize handling and a delta-based clock, but no substantive automated test suite. Its source demonstrates the particle pool and shader approach; it does not establish performance across browsers or hardware.

The useful separation is between deciding a particle's initial state and drawing its state at a particular time. Keeping those responsibilities apart made it possible to experiment with motion equations and blending without introducing thousands of independent scene objects. The next work would be tighter upload accounting and a complete lifetime contract.
