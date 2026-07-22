# Particle Lab Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the particle simulation at a 3× default speed and add a compact top-right Particle Lab panel with seven live parameters and a smoothed FPS counter.

**Architecture:** A typed `SceneParameters` module is the single source of defaults, ranges, labels, and normalization. `ShowcaseApp` owns the current value and routes it to `ParticleSimulation` and `RenderPipeline`; a DOM-only `ParameterPanel` emits complete normalized values, and an injected `FpsCounter` samples successful render timestamps without touching simulation time.

**Tech Stack:** TypeScript, Three.js r185, WebGL2/GPGPU, native HTML range controls, CSS, Vitest/jsdom, Playwright Chromium.

## Global Constraints

- Keep the showcase particle-only with a fixed 128×128 GPGPU simulation and one-device-pixel DPR cap.
- Keep settings session-only; do not use local or session storage.
- Do not add GUI, stats, or state-management dependencies.
- Default simulation speed is exactly 3× and the safe speed range is 0.25–5×.
- Expose exactly speed, orbit strength, turbulence, drag, particle size, bloom strength, and pulse strength.
- Keep reduced-motion force caps, context recovery, static fallback, and existing direct interactions.
- Keep Reset View camera-only; Reset parameters restores the full default preset.

---

### Task 1: Typed Scene Parameters

**Files:**
- Create: `showcase/src/runtime/SceneParameters.ts`
- Create: `showcase/src/runtime/SceneParameters.test.ts`

**Interfaces:**
- Produces: `SceneParameterKey`, `SceneParameters`, `SceneParameterDefinition`, `DEFAULT_SCENE_PARAMETERS`, `SCENE_PARAMETER_DEFINITIONS`, `normalizeSceneParameters(candidate, previous?)`, and `updateSceneParameter(current, key, value)`.

- [ ] **Step 1: Write failing parameter tests**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCENE_PARAMETERS,
  normalizeSceneParameters,
  SCENE_PARAMETER_DEFINITIONS,
  updateSceneParameter,
} from "./SceneParameters";

describe("SceneParameters", () => {
  it("defines the approved defaults and ranges", () => {
    expect(DEFAULT_SCENE_PARAMETERS).toEqual({
      speed: 3, orbitStrength: 0.75, turbulence: 0.35, drag: 0.03,
      particleSize: 16, bloomStrength: 0.65, pulseStrength: 1,
    });
    expect(SCENE_PARAMETER_DEFINITIONS.speed).toMatchObject({ min: 0.25, max: 5 });
    expect(SCENE_PARAMETER_DEFINITIONS.particleSize).toMatchObject({ min: 4, max: 28 });
  });

  it("clamps finite values and preserves the previous value for invalid input", () => {
    const next = normalizeSceneParameters({ ...DEFAULT_SCENE_PARAMETERS, speed: 99, drag: Number.NaN });
    expect(next.speed).toBe(5);
    expect(next.drag).toBe(0.03);
    expect(updateSceneParameter(next, "bloomStrength", -4).bloomStrength).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `cd showcase && npm test -- src/runtime/SceneParameters.test.ts`

Expected: FAIL because `./SceneParameters` does not exist.

- [ ] **Step 3: Implement the typed parameter source**

```ts
export type SceneParameterKey =
  | "speed" | "orbitStrength" | "turbulence" | "drag"
  | "particleSize" | "bloomStrength" | "pulseStrength";

export type SceneParameters = Record<SceneParameterKey, number>;

export type SceneParameterDefinition = {
  label: string;
  min: number;
  max: number;
  step: number;
};

export const DEFAULT_SCENE_PARAMETERS: Readonly<SceneParameters> = Object.freeze({
  speed: 3,
  orbitStrength: 0.75,
  turbulence: 0.35,
  drag: 0.03,
  particleSize: 16,
  bloomStrength: 0.65,
  pulseStrength: 1,
});

export const SCENE_PARAMETER_DEFINITIONS: Readonly<Record<SceneParameterKey, SceneParameterDefinition>> = Object.freeze({
  speed: { label: "Speed", min: 0.25, max: 5, step: 0.25 },
  orbitStrength: { label: "Orbit", min: 0, max: 2, step: 0.05 },
  turbulence: { label: "Turbulence", min: 0, max: 1.5, step: 0.05 },
  drag: { label: "Drag", min: 0, max: 0.5, step: 0.01 },
  particleSize: { label: "Particle size", min: 4, max: 28, step: 1 },
  bloomStrength: { label: "Bloom", min: 0, max: 1.5, step: 0.05 },
  pulseStrength: { label: "Pulse", min: 0, max: 2, step: 0.05 },
});

export function updateSceneParameter(current: SceneParameters, key: SceneParameterKey, value: number): SceneParameters {
  const definition = SCENE_PARAMETER_DEFINITIONS[key];
  const valid = Number.isFinite(value) ? value : current[key];
  return { ...current, [key]: Math.min(definition.max, Math.max(definition.min, valid)) };
}

export function normalizeSceneParameters(
  candidate: Partial<SceneParameters>,
  previous: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS },
): SceneParameters {
  return (Object.keys(SCENE_PARAMETER_DEFINITIONS) as SceneParameterKey[]).reduce(
    (next, key) => updateSceneParameter(next, key, candidate[key] ?? previous[key]),
    { ...previous },
  );
}
```

- [ ] **Step 4: Run the focused test**

Run: `cd showcase && npm test -- src/runtime/SceneParameters.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add showcase/src/runtime/SceneParameters.ts showcase/src/runtime/SceneParameters.test.ts
git commit -m "feat: define particle lab parameters"
```

### Task 2: Route Live Values into GPU Systems

**Files:**
- Modify: `showcase/src/particles/ParticleSimulation.ts`
- Modify: `showcase/src/particles/ParticleSimulation.test.ts`
- Modify: `showcase/src/rendering/RenderPipeline.ts`
- Modify: `showcase/src/rendering/RenderPipeline.test.ts`

**Interfaces:**
- Consumes: `SceneParameters` and `DEFAULT_SCENE_PARAMETERS` from Task 1.
- Produces: `ParticleSimulation.setParameters(parameters: SceneParameters): void` and `RenderPipeline.setBloomStrength(strength: number): void`.

- [ ] **Step 1: Add failing GPU-routing tests**

Add to `ParticleSimulation.test.ts`:

```ts
it("applies live speed, force, size, and pulse parameters", () => {
  const created: FakeCompute[] = [];
  const simulation = new ParticleSimulation({} as THREE.WebGLRenderer, { computeFactory: makeFactory(created) });
  simulation.setParameters({
    speed: 3, orbitStrength: 1.2, turbulence: 0.8, drag: 0.2,
    particleSize: 24, bloomStrength: 0.4, pulseStrength: 1.5,
  });
  simulation.update(frame({ pulseEnergy: 0.6 }));
  const variables = created[0]!.variables;
  const position = variables.find(({ name }) => name === "texturePosition")!;
  const velocity = variables.find(({ name }) => name === "textureVelocity")!;
  const points = simulation.object.children[0] as THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  expect(position.material.uniforms.uDelta!.value).toBeCloseTo(3 / 60);
  expect(velocity.material.uniforms.uDelta!.value).toBeCloseTo(3 / 60);
  expect(velocity.material.uniforms.uOrbitStrength!.value).toBe(1.2);
  expect(velocity.material.uniforms.uTurbulence!.value).toBe(0.8);
  expect(velocity.material.uniforms.uDrag!.value).toBe(0.2);
  expect(velocity.material.uniforms.uPulseEnergy!.value).toBeCloseTo(0.9);
  expect(points.material.uniforms.uPointSize!.value).toBe(24);
});
```

Add to `RenderPipeline.test.ts`:

```ts
it("updates bloom strength through its narrow public setter", () => {
  const pipeline = new RenderPipeline({ renderer: rendererHarness(), scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera() });
  pipeline.setBloomStrength(1.2);
  expect(pipeline.bloomPass.strength).toBe(1.2);
  pipeline.setBloomStrength(-1);
  expect(pipeline.bloomPass.strength).toBe(0);
  pipeline.dispose();
});
```

- [ ] **Step 2: Run the focused tests and confirm missing-method failures**

Run: `cd showcase && npm test -- src/particles/ParticleSimulation.test.ts src/rendering/RenderPipeline.test.ts`

Expected: FAIL because both setters are undefined.

- [ ] **Step 3: Implement particle parameter application**

Import `DEFAULT_SCENE_PARAMETERS` and `SceneParameters`, add a private parameter copy, and add:

```ts
private parameters: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS };

setParameters(parameters: SceneParameters): void {
  if (this.disposed) return;
  this.parameters = { ...parameters };
  this.current.points.material.uniforms.uPointSize!.value = parameters.particleSize;
}
```

In `advanceRuntime`, replace the fixed simulation values with:

```ts
const simulationDelta = frame.deltaSeconds * this.parameters.speed;
setUniform(runtime.position, "uDelta", simulationDelta);
setUniform(runtime.velocity, "uDelta", simulationDelta);
setUniform(runtime.velocity, "uPulseEnergy", frame.interaction.pulseEnergy * this.parameters.pulseStrength * (frame.interaction.reducedMotion ? 0.12 : 1));
setUniform(runtime.velocity, "uOrbitStrength", frame.interaction.reducedMotion ? Math.min(0.2, this.parameters.orbitStrength) : this.parameters.orbitStrength);
setUniform(runtime.velocity, "uTurbulence", frame.interaction.reducedMotion ? 0 : this.parameters.turbulence);
setUniform(runtime.velocity, "uDrag", frame.interaction.reducedMotion ? Math.max(0.3, this.parameters.drag) : this.parameters.drag);
```

- [ ] **Step 4: Implement bloom application**

Add to `RenderPipeline`:

```ts
setBloomStrength(strength: number): void {
  if (this.disposed) return;
  this.bloomPass.strength = Math.min(1.5, Math.max(0, Number.isFinite(strength) ? strength : this.bloomPass.strength));
}
```

- [ ] **Step 5: Run the focused tests**

Run: `cd showcase && npm test -- src/particles/ParticleSimulation.test.ts src/rendering/RenderPipeline.test.ts`

Expected: all focused tests PASS.

- [ ] **Step 6: Commit**

```bash
git add showcase/src/particles/ParticleSimulation.ts showcase/src/particles/ParticleSimulation.test.ts showcase/src/rendering/RenderPipeline.ts showcase/src/rendering/RenderPipeline.test.ts
git commit -m "feat: tune particle simulation live"
```

### Task 3: Smoothed FPS Counter

**Files:**
- Create: `showcase/src/ui/FpsCounter.ts`
- Create: `showcase/src/ui/FpsCounter.test.ts`

**Interfaces:**
- Produces: `FpsSampler` with `sample(nowMs: number): void`, `reset(): void`, and `dispose(): void`; `FpsCounter(publish, options?)` implements it.

- [ ] **Step 1: Write failing FPS tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { FpsCounter } from "./FpsCounter";

describe("FpsCounter", () => {
  it("publishes a stable rolling rate no more than four times per second", () => {
    const publish = vi.fn();
    const counter = new FpsCounter(publish);
    for (let now = 0; now <= 1000; now += 1000 / 60) counter.sample(now);
    expect(publish.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(publish.mock.calls.length).toBeLessThanOrEqual(5);
    expect(publish.mock.lastCall?.[0]).toBeGreaterThanOrEqual(59);
    expect(publish.mock.lastCall?.[0]).toBeLessThanOrEqual(61);
  });

  it("stops publishing after disposal and can reset its sample window", () => {
    const publish = vi.fn();
    const counter = new FpsCounter(publish);
    counter.sample(0); counter.sample(300); counter.reset(); counter.sample(500);
    publish.mockClear(); counter.dispose(); counter.sample(900);
    expect(publish).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `cd showcase && npm test -- src/ui/FpsCounter.test.ts`

Expected: FAIL because `./FpsCounter` does not exist.

- [ ] **Step 3: Implement the counter**

```ts
export type FpsSampler = {
  sample(nowMs: number): void;
  reset(): void;
  dispose(): void;
};

export class FpsCounter implements FpsSampler {
  private samples: number[] = [];
  private lastPublishedAt = Number.NEGATIVE_INFINITY;
  private disposed = false;

  constructor(
    private readonly publish: (fps: number) => void,
    private readonly publishIntervalMs = 250,
    private readonly sampleWindowMs = 1000,
  ) {}

  sample(nowMs: number): void {
    if (this.disposed || !Number.isFinite(nowMs)) return;
    this.samples.push(nowMs);
    const cutoff = nowMs - this.sampleWindowMs;
    while (this.samples.length > 1 && this.samples[0]! < cutoff) this.samples.shift();
    if (this.samples.length < 2 || nowMs - this.lastPublishedAt < this.publishIntervalMs) return;
    const duration = nowMs - this.samples[0]!;
    if (duration <= 0) return;
    this.lastPublishedAt = nowMs;
    this.publish(Math.round(((this.samples.length - 1) * 1000) / duration));
  }

  reset(): void {
    this.samples = [];
    this.lastPublishedAt = Number.NEGATIVE_INFINITY;
  }

  dispose(): void {
    this.disposed = true;
    this.samples = [];
  }
}
```

- [ ] **Step 4: Run the focused test**

Run: `cd showcase && npm test -- src/ui/FpsCounter.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add showcase/src/ui/FpsCounter.ts showcase/src/ui/FpsCounter.test.ts
git commit -m "feat: add smoothed fps counter"
```

### Task 4: Accessible Particle Lab Panel

**Files:**
- Create: `showcase/src/ui/ParameterPanel.ts`
- Create: `showcase/src/ui/ParameterPanel.test.ts`
- Modify: `showcase/index.html`
- Modify: `showcase/src/styles.css`

**Interfaces:**
- Consumes: parameter defaults, definitions, keys, normalization, and update function from Task 1.
- Produces: `ParameterPanel({ root, initial, collapsed, onChange })` with `setParameters(parameters)` and `dispose()`.

- [ ] **Step 1: Write failing panel tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SCENE_PARAMETERS } from "../runtime/SceneParameters";
import { ParameterPanel } from "./ParameterPanel";

function panelRoot(): HTMLElement {
  document.body.innerHTML = `<aside class="particle-lab"><button data-panel-toggle></button><div data-panel-body></div><button data-parameter-reset></button></aside>`;
  return document.querySelector<HTMLElement>(".particle-lab")!;
}

describe("ParameterPanel", () => {
  it("builds seven labeled sliders and publishes normalized input", () => {
    const onChange = vi.fn();
    const panel = new ParameterPanel({ root: panelRoot(), initial: { ...DEFAULT_SCENE_PARAMETERS }, collapsed: false, onChange });
    const speed = document.querySelector<HTMLInputElement>('[data-parameter="speed"]')!;
    expect(document.querySelectorAll('input[type="range"]')).toHaveLength(7);
    speed.value = "4.5"; speed.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4.5 }));
    panel.dispose();
  });

  it("resets values, reflects collapse state, and removes listeners", () => {
    const root = panelRoot();
    const onChange = vi.fn();
    const panel = new ParameterPanel({ root, initial: { ...DEFAULT_SCENE_PARAMETERS, speed: 1 }, collapsed: true, onChange });
    const toggle = root.querySelector<HTMLButtonElement>("[data-panel-toggle]")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    toggle.click(); expect(toggle.getAttribute("aria-expanded")).toBe("true");
    root.querySelector<HTMLButtonElement>("[data-parameter-reset]")!.click();
    expect(onChange).toHaveBeenLastCalledWith(DEFAULT_SCENE_PARAMETERS);
    panel.dispose(); onChange.mockClear(); toggle.click();
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing-module failure**

Run: `cd showcase && npm test -- src/ui/ParameterPanel.test.ts`

Expected: FAIL because `./ParameterPanel` does not exist.

- [ ] **Step 3: Implement the panel controller**

```ts
import {
  DEFAULT_SCENE_PARAMETERS, normalizeSceneParameters, SCENE_PARAMETER_DEFINITIONS,
  updateSceneParameter, type SceneParameterKey, type SceneParameters,
} from "../runtime/SceneParameters";

export type ParameterPanelOptions = {
  root: HTMLElement;
  initial: SceneParameters;
  collapsed: boolean;
  onChange(parameters: SceneParameters): void;
};

export class ParameterPanel {
  private current: SceneParameters;
  private readonly cleanups: Array<() => void> = [];
  private readonly body: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private disposed = false;

  constructor(private readonly options: ParameterPanelOptions) {
    this.current = normalizeSceneParameters(options.initial);
    this.body = options.root.querySelector<HTMLElement>("[data-panel-body]")!;
    this.toggle = options.root.querySelector<HTMLButtonElement>("[data-panel-toggle]")!;
    this.buildInputs();
    this.setCollapsed(options.collapsed);
    this.listen(this.toggle, "click", () => this.setCollapsed(this.toggle.getAttribute("aria-expanded") === "true"));
    const reset = options.root.querySelector<HTMLButtonElement>("[data-parameter-reset]");
    if (reset !== null) this.listen(reset, "click", () => { this.setParameters({ ...DEFAULT_SCENE_PARAMETERS }); options.onChange({ ...this.current }); });
  }

  setParameters(parameters: SceneParameters): void {
    this.current = normalizeSceneParameters(parameters, this.current);
    for (const input of this.options.root.querySelectorAll<HTMLInputElement>("[data-parameter]")) {
      const key = input.dataset.parameter as SceneParameterKey;
      input.value = String(this.current[key]);
      const output = this.options.root.querySelector<HTMLOutputElement>(`[data-parameter-value="${key}"]`);
      if (output !== null) output.value = input.value;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private buildInputs(): void {
    this.body.replaceChildren();
    for (const [key, definition] of Object.entries(SCENE_PARAMETER_DEFINITIONS) as Array<[SceneParameterKey, typeof SCENE_PARAMETER_DEFINITIONS[SceneParameterKey]]>) {
      const label = document.createElement("label");
      label.className = "particle-lab__control";
      label.innerHTML = `<span>${definition.label}</span><output data-parameter-value="${key}"></output>`;
      const input = document.createElement("input");
      input.type = "range"; input.dataset.parameter = key;
      input.min = String(definition.min); input.max = String(definition.max); input.step = String(definition.step);
      label.append(input); this.body.append(label);
      this.listen(input, "input", () => { this.current = updateSceneParameter(this.current, key, input.valueAsNumber); this.setParameters(this.current); this.options.onChange({ ...this.current }); });
    }
    this.setParameters(this.current);
  }

  private setCollapsed(collapsed: boolean): void {
    this.options.root.dataset.collapsed = String(collapsed);
    this.toggle.setAttribute("aria-expanded", String(!collapsed));
    this.body.hidden = collapsed;
  }

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.cleanups.push(() => target.removeEventListener(type, listener));
  }
}
```

- [ ] **Step 4: Add semantic shell markup and responsive styles**

Add this sibling after `.showcase-controls` in `index.html`:

```html
<aside class="particle-lab" aria-label="Particle Lab controls">
  <header class="particle-lab__header">
    <strong>Particle Lab</strong>
    <output class="particle-lab__fps" data-fps aria-live="off">-- FPS</output>
    <button class="particle-lab__toggle" type="button" data-panel-toggle aria-label="Toggle Particle Lab">⌃</button>
  </header>
  <div class="particle-lab__body" data-panel-body></div>
  <button class="particle-lab__reset" type="button" data-parameter-reset>Reset parameters</button>
</aside>
```

Add these styles:

```css
.particle-lab {
  position: absolute;
  z-index: 2;
  top: 1rem;
  right: 1rem;
  width: min(19rem, calc(100vw - 2rem));
  padding: 0.85rem;
  border: 1px solid rgb(174 222 255 / 20%);
  border-radius: 0.9rem;
  background: rgb(3 5 13 / 78%);
  box-shadow: 0 1rem 3rem rgb(0 0 0 / 28%);
  backdrop-filter: blur(14px);
}
.particle-lab__header {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 0.7rem;
}
.particle-lab__fps { color: #80f4ff; font-variant-numeric: tabular-nums; }
.particle-lab__toggle, .particle-lab__reset { color: inherit; border: 1px solid rgb(174 222 255 / 28%); background: rgb(14 26 48 / 82%); }
.particle-lab__body { display: grid; gap: 0.75rem; margin-top: 0.9rem; }
.particle-lab__control { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 0.75rem; font-size: 0.82rem; }
.particle-lab__control output { font-variant-numeric: tabular-nums; color: #b9f8ff; }
.particle-lab__control input { grid-column: 1 / -1; width: 100%; accent-color: #6debf5; }
.particle-lab__reset { width: 100%; margin-top: 0.9rem; padding: 0.45rem 0.6rem; border-radius: 0.5rem; }
.particle-lab button:focus-visible, .particle-lab input:focus-visible { outline: 2px solid #8ff7ff; outline-offset: 2px; }
.particle-lab[data-collapsed="true"] .particle-lab__reset { display: none; }
html[data-showcase-state="recovering"] .particle-lab,
html[data-showcase-state="fallback"] .particle-lab { display: none; }
@media (max-width: 700px) {
  .particle-lab { width: auto; min-width: 12rem; }
}
```

- [ ] **Step 5: Run the panel and shell tests**

Run: `cd showcase && npm test -- src/ui/ParameterPanel.test.ts src/showcase-shell.test.ts`

Expected: focused tests PASS after updating the shell assertion to expect the Particle Lab markup and no quality selector.

- [ ] **Step 6: Commit**

```bash
git add showcase/src/ui/ParameterPanel.ts showcase/src/ui/ParameterPanel.test.ts showcase/index.html showcase/src/styles.css showcase/src/showcase-shell.test.ts
git commit -m "feat: add particle lab panel"
```

### Task 5: App, Bootstrap, Recovery, and Browser Integration

**Files:**
- Modify: `showcase/src/app/ShowcaseApp.ts`
- Modify: `showcase/src/app/ShowcaseApp.test.ts`
- Modify: `showcase/src/main.ts`
- Modify: `showcase/src/main.test.ts`
- Modify: `showcase/e2e/showcase.e2e.ts`

**Interfaces:**
- Consumes: `SceneParameters`, `DEFAULT_SCENE_PARAMETERS`, `normalizeSceneParameters`, `ParameterPanel`, `FpsCounter`, `ParticleSimulation.setParameters`, and `RenderPipeline.setBloomStrength`.
- Produces: `ShowcaseApp.setSceneParameters(parameters: SceneParameters): void`; `ShowcaseAppOptions.onFps?: (fps: number) => void`; test telemetry `data-scene-speed` only when `?test=1` is active.

- [ ] **Step 1: Add failing application-routing tests**

Extend the app harness with these exact doubles and factory entry, and include `fps` in its return value:

```ts
const particles = {
  object: {}, update: vi.fn(() => calls.push("particles.update")), setParameters: vi.fn(),
  getPositionTexture: vi.fn(), dispose: vi.fn(() => calls.push("particles.dispose")),
};
const pipeline = {
  render: vi.fn(() => calls.push("pipeline.render")), resize: vi.fn(),
  setBloomStrength: vi.fn(), dispose: vi.fn(() => calls.push("pipeline.dispose")),
};
const fps = { sample: vi.fn(), reset: vi.fn(), dispose: vi.fn() };
// Inside factories:
createFpsCounter: vi.fn(() => fps),
// Return fps with the other harness members.
```

Then add this test:

```ts
it("applies the 3x preset, routes updates, samples FPS, and reapplies after recovery", () => {
  const h = makeHarness();
  expect(h.particles.setParameters).toHaveBeenCalledWith(expect.objectContaining({ speed: 3 }));
  expect(h.pipeline.setBloomStrength).toHaveBeenCalledWith(0.65);
  h.app.setSceneParameters({
    speed: 4, orbitStrength: 1, turbulence: 0.5, drag: 0.1,
    particleSize: 20, bloomStrength: 1.1, pulseStrength: 1.5,
  });
  expect(h.particles.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4 }));
  expect(h.pipeline.setBloomStrength).toHaveBeenLastCalledWith(1.1);
  h.app.start(); h.runFrame(116);
  expect(h.fps.sample).toHaveBeenCalledWith(116);
  h.canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  h.canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(h.particles.setParameters).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4 }));
  expect(h.root.dataset.sceneSpeed).toBe("4");
  h.app.dispose();
  expect(h.fps.dispose).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run app tests and confirm missing interfaces**

Run: `cd showcase && npm test -- src/app/ShowcaseApp.test.ts`

Expected: FAIL because the parameter setter and FPS factory are absent.

- [ ] **Step 3: Implement app ownership and routing**

Add `createFpsCounter: (publish: (fps: number) => void) => FpsSampler` to `ShowcaseAppFactories`, `onFps?: (fps: number) => void` to options, and these members/methods:

```ts
private parameters: SceneParameters = { ...DEFAULT_SCENE_PARAMETERS };
private readonly fpsCounter: FpsSampler;

setSceneParameters(parameters: SceneParameters): void {
  if (this.disposed) return;
  this.parameters = normalizeSceneParameters(parameters, this.parameters);
  this.applyParameters();
  if (this.testMode) this.root.dataset.sceneSpeed = String(this.parameters.speed);
}

private applyParameters(): void {
  this.systems.particles.setParameters(this.parameters);
  this.systems.pipeline.setBloomStrength(this.parameters.bloomStrength);
}
```

Construct `fpsCounter` through the factory, call `applyParameters()` after initial GPU creation and context restoration, call `fpsCounter.sample(nowMs)` after each successful render, call `fpsCounter.reset()` on visibility/context interruptions, dispose it with the app, and include `sceneSpeed` in test telemetry cleanup.

- [ ] **Step 4: Add failing bootstrap panel tests**

Add the Particle Lab shell to the main-test page fixture:

```html
<aside class="particle-lab">
  <output data-fps>-- FPS</output>
  <button type="button" data-panel-toggle></button>
  <div data-panel-body></div>
  <button type="button" data-parameter-reset>Reset parameters</button>
</aside>
```

Use an app double with `setSceneParameters: vi.fn()` and capture `ShowcaseAppOptions`. Add:

```ts
it("wires Particle Lab parameters, fps, reset, and desktop collapse state", () => {
  page();
  let appOptions: ShowcaseAppOptions | undefined;
  const app = { start: vi.fn(), resetView: vi.fn(), setSceneParameters: vi.fn(), dispose: vi.fn(), registerCleanup: vi.fn() };
  bootstrapShowcase({
    createApp: (options) => { appOptions = options; return app; },
    media: (query) => ({ matches: query.includes("prefers-reduced-motion") ? false : false }) as MediaQueryList,
  });
  const speed = document.querySelector<HTMLInputElement>('[data-parameter="speed"]')!;
  expect(speed.value).toBe("3");
  speed.value = "4"; speed.dispatchEvent(new Event("input", { bubbles: true }));
  expect(app.setSceneParameters).toHaveBeenLastCalledWith(expect.objectContaining({ speed: 4 }));
  appOptions!.onFps?.(58);
  expect(document.querySelector("[data-fps]")!.textContent).toBe("58 FPS");
  document.querySelector<HTMLButtonElement>("[data-parameter-reset]")!.click();
  expect(speed.value).toBe("3");
  expect(document.querySelector("[data-panel-toggle]")!.getAttribute("aria-expanded")).toBe("true");
});
```

Add a second bootstrap test whose media function returns `true` only for `(max-width: 700px)` and assert the toggle starts at `aria-expanded="false"`. In the existing cleanup test, store the registered cleanup, invoke it, and confirm later input/toggle events no longer call `setSceneParameters`.

Run: `cd showcase && npm test -- src/main.test.ts`

Expected: FAIL because bootstrap does not construct the panel or wire FPS.

- [ ] **Step 5: Wire the panel and FPS output in bootstrap**

Import `ParameterPanel` and `DEFAULT_SCENE_PARAMETERS`, extend `AppControls` with `setSceneParameters`, and add:

```ts
const fpsOutput = activeDocument.querySelector<HTMLOutputElement>("[data-fps]");
// Pass this callback in ShowcaseAppOptions:
onFps: (fps) => { if (fpsOutput !== null) fpsOutput.value = `${fps} FPS`; },

const panelRoot = activeDocument.querySelector<HTMLElement>(".particle-lab");
if (panelRoot !== null) {
  const panel = new ParameterPanel({
    root: panelRoot,
    initial: { ...DEFAULT_SCENE_PARAMETERS },
    collapsed: media("(max-width: 700px)").matches,
    onChange: (parameters) => app.setSceneParameters(parameters),
  });
  app.registerCleanup?.(() => panel.dispose());
}
```

Keep the panel optional so missing markup does not block animation startup.

- [ ] **Step 6: Add browser coverage for FPS, live controls, reset, collapse, and mobile state**

Add desktop coverage:

```ts
test("exposes live particle controls, fps, reset, and collapse", async ({ page }) => {
  await page.goto("/showcase/?test=1");
  await expectReady(page);
  await expect(page.locator("[data-fps]")).toHaveText(/\d+ FPS/);
  const speed = page.locator('[data-parameter="speed"]');
  await expect(speed).toHaveValue("3");
  await speed.fill("4.5");
  await expect(page.locator("html")).toHaveAttribute("data-scene-speed", "4.5");
  await page.getByRole("button", { name: "Reset parameters" }).click();
  await expect(speed).toHaveValue("3");
  const toggle = page.getByRole("button", { name: "Toggle Particle Lab" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});
```

Extend the existing mobile browser test with:

```ts
await expect(page.getByRole("button", { name: "Toggle Particle Lab" })).toHaveAttribute("aria-expanded", "false");
```

Add `"data-scene-speed"` to `telemetryAttributes`, add `"sceneSpeed"` to both application telemetry-cleanup loops, and expect `data-scene-speed="3"` in the initial test-mode browser state.

- [ ] **Step 7: Run focused and full verification**

Run:

```bash
cd showcase
npm run typecheck
npm test
npm run build
npx playwright test e2e/showcase.e2e.ts --project=chromium
```

Expected: typecheck PASS; all unit tests PASS; production build PASS except the existing non-blocking bundle-size warning; all Chromium tests PASS with visible particle pixels.

- [ ] **Step 8: Commit**

```bash
git add showcase/src/app/ShowcaseApp.ts showcase/src/app/ShowcaseApp.test.ts showcase/src/main.ts showcase/src/main.test.ts showcase/e2e/showcase.e2e.ts
git commit -m "feat: integrate particle lab controls"
```

### Task 6: Visual Verification and Cleanup

**Files:**
- Modify only files needed to correct issues found during live verification.

**Interfaces:**
- Consumes: the complete Particle Lab feature from Tasks 1–5.
- Produces: a clean, reviewable branch with no generated Playwright artifacts.

- [ ] **Step 1: Run a production preview and inspect desktop**

Run: `cd showcase && npm run preview -- --host 127.0.0.1 --port 4175`

Verify in the browser that particles are visibly faster, the panel does not obscure the main orbit, all sliders react live, FPS stabilizes, and collapse/reset work.

- [ ] **Step 2: Inspect a 390×844 viewport**

Verify the panel starts collapsed, expands without overflowing the viewport, and canvas drag/tap remains usable outside the panel.

- [ ] **Step 3: Re-run final checks after any visual fix**

Run:

```bash
cd showcase
npm run typecheck
npm test
npm run build
npx playwright test e2e/showcase.e2e.ts --project=chromium
git diff --check
git status --short
```

Expected: every check PASS; `git status --short` contains only intentional source changes and no `test-results` directory.

- [ ] **Step 4: Commit visual corrections if any**

```bash
git add showcase
git commit -m "fix: polish particle lab controls"
```
