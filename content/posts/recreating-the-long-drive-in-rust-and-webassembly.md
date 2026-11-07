---
title: "Recreating The Long Drive in Rust and WebAssembly"
description: "The engineering behind a browser port of a Unity driving game: exporting an installed build, a simulation worker, floating-origin physics, WheelCollider tires, and a WebGPU frame budget."
date: "2026-11-02"
tags: [Game development, Rust, WebAssembly]
draft: false
---

This project recreates The Long Drive, a Unity survival driving game, in the browser. You prepare a Lada 2101 in a garage, drive onto an endless desert road, and keep the car and yourself alive. The goal is behavior parity with one specific build: Steam build 11140890, made with Unity 2021.3.18f1.

The port uses Rust, Bevy 0.19, and Rapier 0.36. The browser runs it as WebAssembly with a WebGPU renderer. A Python exporter reads the game from a local Steam install, and the repository ships no game assets. In the first 26 days the project grew to about 2,000 commits, 187,000 lines of Rust, and 21,000 lines of Python.

Most of that work is ordinary feature porting: items, food, radios, guns, creatures, weather. This post covers the parts that resisted: getting trustworthy data out of a compiled Unity build, splitting the game across threads, keeping physics stable on a road that never ends, reproducing Unity's wheel model, and keeping the frame rate near 60 FPS in a browser.

## Turning an installed Unity build into a reference

A recreation needs two kinds of truth: what the game contains and what it does. The exporter gets both from the installed build and refuses to continue when it cannot prove what it read.

For content, it reads the serialized Unity files with UnityPy. It resolves object references, repairs MonoBehaviour headers and generated array container types, and checks that the reader consumed every byte of each object. Selected hierarchies become glTF files for Bevy. The Lada, for example, is the world prototype with path ID 82556 in `sharedassets1.assets`.

For behavior, it decompiles every managed assembly with a pinned ILSpy package. Decompiled C# is easy to misread when the decompiler silently drops a method body. The exporter therefore keeps a coverage record for each method and compares MethodDef tokens, signatures, body addresses, and IL hashes against an independent metadata index. A report separates three states: every method accounted for, every IL body emitted as C#, and no gaps at all. The decompiled `Assembly-CSharp` is the behavior authority. Rust code uses the source names, such as `carscript.SetWheel` or `wheelgraphicsscript.WheelSize`, so you can find the original method from any port.

Unity is left-handed with Z forward; glTF is right-handed. The conversion applies `C = diag(1, 1, -1)` exactly once, at export:

```python
def convert_point(value):
    return value[0], value[1], -value[2]

def convert_rotation(value):
    return -value[0], -value[1], value[2], value[3]

def convert_triangles(values):
    return [(a, c, b) for a, b, c in values]
```

Bind poses, tangent handedness, and collider points follow the same rule. The rule has to apply once and only once. A second reflection in a loader or a skinning path produces models that look correct until an animation or a collider disagrees with them.

The export also has to stay in step with the game code. An early version copied shaders into the exported package. After a shader change, an old package still held a 416-byte uniform block while the new pipeline layout expected 384 bytes, and validation failed until the next export. Shaders now compile into the WASM with `include_str!`, and the exporter writes only data. A runtime verifier checks file hashes, scene dependencies, and a contract checksum over the source spawners and weights before it promotes a new export. The [export notes](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/tools/reference/README.md) and the [glTF converter](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/tools/reference/gltf.py) show the full set of checks.

## Running the simulation in a Web Worker

One browser thread could not do physics, game logic, and WebGPU rendering in 16.7 ms. Bevy's multithreading in the browser needs `SharedArrayBuffer` and cross-origin isolation, and it was not stable. I moved the simulation into its own Web Worker instead and kept the main thread for rendering only.

The split took more than thirty pull requests over two days. Each one moved a single kind of state behind the boundary while the game stayed playable: body poses first, then food and items, particles, part conditions, camera facts, HUD values, audio calls, world structure views, and finally the save path.

| Part | Responsibility |
| --- | --- |
| `crates/simulation` | All game state and behavior, with no render code |
| `crates/simulation-worker` | Worker entry with its own WASM memory and one session |
| Root crate | Bevy renderer on the main thread |
| `boundary.rs` | The only interface: `SimCommand` in, `SimFrame` out |
| Terrain, road, grass workers | Mesh generation on the same pattern |

The renderer sends one command per rendered frame, and the worker answers with one frame per command. Only one command is in flight at a time. If the renderer produces another frame before the answer arrives, the new command merges into the pending one: elapsed time adds up, input accumulates, and save requests append.

```text
Render frame
    -> SimCommand (input, delta time, requests)
    -> merge into pending if one is in flight
    -> worker steps physics at 50 Hz
    -> SimFrame (changed pose rows, facts, audio, HUD)
    -> renderer interpolates and draws
```

Poses travel as `Pod` rows of position, flags, and rotation, and buffers move with `postMessage` transfer. A frame encoder remembers the last rows it sent and writes only the changed slots. Dense handles index those rows. A retired handle is not reused until the renderer has seen the retirement, so a stale row can never be applied to a new object.

The original steps physics at Unity's fixed delta of `0.02`. The Rust constant is `0.01999999955`, the value that `0.02f` actually stores, because small differences add up over a long drive. The step clock caps catch-up at two steps per frame and drops the remaining backlog. Below 25 FPS the simulation runs slower than real time instead of spending more time on physics. The renderer shows state one tick late and interpolates between ticks to hide it.

The boundary has a cost. Every new piece of state the renderer shows needs a row or a message, and each worker loads its own WASM module, five in total. In return, simulation work no longer takes frame time, and native tests run the whole simulation without a browser or a GPU. The [decision record](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/docs/adr/0001-run-the-simulation-in-a-web-worker.md), the [boundary types](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/crates/simulation/src/boundary.rs), and the [renderer link](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/src/app/sim_link.rs) contain the details.

## Keeping physics precise on an endless road

The road goes on for as long as you drive. Rapier works in `f32`, which has about seven significant digits, so collision quality falls as the player moves away from the origin.

The first sign was not jitter. Rapier takes the normal of a touching shape cast from GJK closest points. Against large boxes, roughly 2,000 units from the origin, a flat floor came back as an 80-degree wall, and the player could not walk up a gentle slope. Player movement queries now go through a custom query dispatcher that takes cast normals from a contact manifold at the impact pose.

That fixed the symptom but not the cause. The world now keeps absolute positions in `f64` and a physics origin:

```rust
pub const REBASE_LIMIT: f32 = 2048.0;

pub struct WorldOrigin {
    pub offset: [f64; 3],
}
```

When the player gets more than 2,048 m from the physics origin on either horizontal axis, the stream shifts the origin by a multiple of 128 m between physics steps. Every body and collider moves by the same amount, and pending terrain geometry stays in absolute coordinates until it is published. Particles that simulate in world space keep absolute positions so their trails survive a shift.

The rebase still had one hidden assumption. Rapier can recycle contact pairs between steps, and a recycled pair keeps its points on fixed colliders in world space. After a rebase moved the fixed colliders, recycled contacts pushed against the old surface position. Items in revisited buildings sank through floors or spun off shelves. Turning off contact recycling fixed that bug. It also exposed a test that had placed the player inside the start car: with fresh contacts, the overlap launched the car.

The [floating-origin stream](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/crates/simulation/src/world/stream.rs) and the [character normals](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/crates/simulation/src/player/normals.rs) contain both fixes.

## Reproducing Unity's WheelCollider

The first driving model used Rapier's ray-cast vehicle. It drove, but it did not feel like the original, because The Long Drive configures Unity's `WheelCollider` and adds its own scripts on top. The wheel parameters are in the export, but the behavior of PhysX's wheel is not in the managed code. I rebuilt it from the exported wheel settings, Unity's documented parameters, and the game's scripts.

Each wheel casts a ray for its suspension and uses the source spring, damper, travel, and target position. It spins on its own inertia in 20 substeps per physics step, which keeps a stiff tire stable. Tire force comes from the source friction curves, multiplied by stiffness and suspension load. A curve rises to an extremum, falls to an asymptote, and then holds:

```rust
let value = if s <= curve.extremum_slip {
    let t = s / curve.extremum_slip;
    curve.extremum_value * t * (2.0 - t)
} else if s < curve.asymptote_slip {
    let t = (s - curve.extremum_slip) / (curve.asymptote_slip - curve.extremum_slip);
    curve.extremum_value
        + (curve.asymptote_value - curve.extremum_value) * t * t * (3.0 - 2.0 * t)
} else {
    curve.asymptote_value
};
```

Tire condition changes stiffness. A bare rim uses the source rim slip values at rim radius, and an empty slot puts the car on its hub.

A slip curve describes a moving tire well and a parked one badly. At low slip the curve gives almost no force, so a player who walked into a parked Lada pushed it at about 0.6 m/s. Applying each wheel's impulse on its own cancelled only a quarter of the chassis velocity.

Tire impulses now come from four projected Gauss-Seidel passes over the four contacts. Each pass computes the impulse that would stop a contact's slip, clamps the accumulated impulse to the force limit, and scales the pair back inside a friction ellipse. A braked wheel at rest, or sideways slip below 1 m/s, may use the peak curve force in either direction, which gives static grip. Sliding grip stays limited to the curve force and never drives the contact past the wheel's surface speed. When a wheel stands on another dynamic body, the reaction impulse goes to that body as well. The [wheel model](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/crates/simulation/src/vehicle/wheel.rs) and the [contact solve](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/crates/simulation/src/vehicle/wheel_set.rs) are separate from the rest of the car code.

## Holding 60 FPS in WebGPU

The project has one rule for every feature: check the F3 overlay before and after, report the frame-time cost, and fix a regression before merge. WebGPU became the only renderer early on. Keeping a WebGL2 build meant keeping two shader outputs and two sets of workarounds.

Most of the frame time came from the number of things to draw, not from shading. These changes made the largest difference:

| Problem | Change |
| --- | --- |
| Static props as individual entities | Props become GPU rows; a compute pass culls them per view and fills indirect draws |
| Re-encoding the same draws each frame | Each view pass records its prop draws into a render bundle, recorded again only when commands change |
| Redrawing shadow casters | Each shadow atlas keeps a static copy; each frame copies it and draws only grass and skinned casters |
| Testing every caster against every shadow hull | A loose 32 m grid skips cells, with masks bit-identical to the linear pass |
| Unity's base plus additive light passes | Opaque surfaces add the `ForwardAdd` result inside the `ForwardBase` draw |
| A pipeline compiling while shown | A changed material waits as a pending binding until its pipeline is ready |

Memory needed the same discipline. The streamed world can request more meshes and textures than WASM memory can hold. The renderer keeps a ledger of credit, use, and wanted room across CPU bytes, GPU bytes, staging, and worker caches. An admission check spends credit; a shortfall records a want and waits. Once per frame the ledger reports to the world stream, which grants free room or asks for credit back when its own work is waiting. Early versions failed hard when a cache filled. One example was a shadow specialization cache that grew with every re-prepared material until it stopped the game. The rule now is to wait or reclaim, not to fail.

Some costs came from the browser itself. Bevy's FPS limit used timed updates, which the web runs as timer tasks off the display refresh, and the overlay showed about 52 FPS against a 60 FPS limit. A small [frame pacer](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/web/frame-pacer.js) now starts each limited frame from `requestAnimationFrame`. Startup had its own problem: JavaScript parsed 107 MB of world records only to read a few fields. A Rust shell now copies just those fields with `serde_json::RawValue`, and the game code downloads and compiles while the manifest downloads. The release build enables `simd128`, so glam and Rapier's wide-lane solver compile to SIMD, and it runs `wasm-opt -O3` on each module.

The [prop draws](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/src/presentation/prop_draws.rs), the [shadow cache](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/src/presentation/shadow_cache.rs), and the [renderer ledger](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/src/ownership/ledger.rs) show how those changes fit into the frame.

## Testing a recreation against its original

Parity is hard to test with screenshots alone. Because the simulation crate has no render code, a headless test kit could drive real sessions natively: spawn in the garage, sit in a car, drive, shoot a tank, save, and load. For a few days I turned the roadmap's behavior rows into tests like these. Fixing the rows that failed turned up real bugs, such as a save that panicked after a tank blast destroyed an item.

Then I removed most of them. Tests that pinned gameplay details broke on every faithful change to that gameplay. The suite now keeps what must not regress: save and load, the worker wire format, the export contract, the fixed step, and world generation. The world tests generate roads and buildings incrementally and sequentially from the same seed and require identical results, and a saved world must continue exactly where it stopped. For everything else, a browser sandbox gives a manual test pass helpers such as `teleport`, `spawn`, `seat`, and `storm`.

These checks cover behavior, not appearance. Lighting and materials are ported from the source shaders, and I do not claim pixel parity without a matched live view of the original. The open work is short: the UFO seat and its autopilot, and the rest of the multiplayer port. The renderer and the simulation now have the boundaries those features need. The [world tests](https://github.com/corashina/the-long-slop/blob/1b48de1d2d35d29ccce0954db35c8f8be52a2cac/tests/world_frontiers.rs) show the determinism checks.
