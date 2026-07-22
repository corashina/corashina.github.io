# Particle Lab Controls Design

## Goal

Make the particle showcase feel substantially more energetic, expose a compact set of live simulation controls, and display current rendering performance without reintroducing adaptive quality or non-particle scene systems.

## Scope

The showcase remains a fixed-cost, particle-only WebGL scene with a 128×128 GPGPU simulation. The change adds:

- a 3× default simulation-speed preset;
- a live FPS counter;
- a compact, dependency-free parameter panel;
- session-only parameter editing and reset behavior.

The change does not add quality levels, persistence, new scene layers, third-party GUI libraries, or automatic performance adaptation.

## Runtime Architecture

A typed `SceneParameters` value owns the seven adjustable settings:

| Parameter | Default | Range |
| --- | ---: | ---: |
| Speed | 3× | 0.25–5× |
| Orbit strength | 0.75 | 0–2 |
| Turbulence | 0.35 | 0–1.5 |
| Drag | 0.03 | 0–0.5 |
| Particle size | 16 | 4–28 |
| Bloom strength | 0.65 | 0–1.5 |
| Pulse strength | 1 | 0–2 |

`ShowcaseApp` owns the current parameter value. A control-panel component emits validated changes to the app. The app forwards particle-related values to `ParticleSimulation` and bloom strength to `RenderPipeline` through explicit, typed methods.

Simulation speed scales the delta passed to particle computation. It does not alter camera motion, pointer sampling, the FPS measurement, or the browser animation loop. The default is visibly energetic at 3× while the slider allows slower and faster experimentation.

`Reset View` continues to reset only the camera. A separate `Reset parameters` action restores the complete default preset, including the 3× speed.

## Particle and Rendering Behavior

`ParticleSimulation` uses live values for speed, orbit strength, turbulence, drag, particle size, and pulse strength. Values are clamped before they reach shader uniforms. Pulse strength scales the existing click/tap pulse energy rather than changing interaction timing.

`RenderPipeline` exposes a narrow bloom-strength setter. No other post-processing parameter is user-adjustable.

Reduced-motion mode retains its existing caps on turbulence and interaction forces. The selected simulation speed remains available because it is an explicit user setting. The scene keeps its fixed 128×128 particle density and current DPR cap.

## FPS Counter

The FPS counter receives timestamps from rendered frames in the existing application loop. It computes a smoothed value over a rolling interval of approximately one second and publishes display updates only a few times per second. This avoids per-frame DOM writes and produces a stable, readable value.

The counter is informational only. It never changes scene settings. It stops updating and releases its callback when the application is disposed.

## Control Panel Interface

A translucent panel sits in the top-right corner. Its header contains:

- the title `Particle Lab`;
- the current FPS value;
- a collapse/expand button.

The expanded body contains seven native range inputs. Every input has a visible label and current numeric value. A `Reset parameters` button appears below the sliders.

The existing interaction hint and `Reset View` control remain in the top-left. On narrow screens, the panel starts collapsed to preserve the canvas. Its collapsed state does not persist across reloads.

The panel uses native controls, keyboard-accessible labels, visible focus styles, readable contrast, and ARIA state on the collapse button. If panel markup is absent, the scene continues with default parameters.

## Lifecycle and Failure Handling

Every parameter update is normalized and clamped through one parameter utility before it reaches rendering systems. Invalid numeric input falls back to the previous valid value.

The panel owns its DOM listeners and releases them through the existing app cleanup registration. The FPS counter stops publishing during disposal. WebGL context loss and restoration recreate GPU systems, then reapply the current parameter value so the panel and scene remain synchronized.

The existing static fallback remains particle-only. During fallback, interactive controls are hidden with the rest of the showcase controls.

## Testing

Unit coverage will verify:

- parameter defaults, normalization, and clamping;
- particle uniform updates, 3× simulation delta, size changes, and pulse scaling;
- bloom-strength updates;
- FPS sampling, smoothing, throttled publication, and reset behavior;
- panel input, displayed values, reset, collapse, mobile initial state, and listener cleanup;
- app parameter routing, context-restoration reapplication, and disposal.

Browser coverage will verify that:

- the panel and FPS counter appear on desktop;
- a slider changes scene telemetry or observable control state;
- reset restores the default 3× preset;
- collapse behavior works;
- the panel starts collapsed at a mobile viewport;
- particles remain visibly rendered without a blank black or white frame;
- existing direct interaction, reduced-motion, and context-recovery behavior remains intact.

## Acceptance Criteria

- Particles run at 3× the prior default speed on initial load.
- The user can adjust all seven approved parameters live.
- Reset parameters restores the documented defaults.
- The top-right panel shows a stable live FPS value and can collapse.
- Mobile loads with the panel collapsed.
- Settings reset on page reload and are never stored locally.
- No adaptive-quality selector, blob, reflective plane, water, nebula, or other non-particle scene layer returns.
- Typecheck, unit tests, production build, and Chromium browser tests pass.
