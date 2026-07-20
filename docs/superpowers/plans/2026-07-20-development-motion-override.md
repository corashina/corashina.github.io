# Development Motion Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a development-only `?motion=full` URL override that animates the particle background when the browser prefers reduced motion, while production continues respecting that preference.

**Architecture:** Keep the decision at the React integration boundary. A pure exported helper resolves the browser preference from `import.meta.env.DEV` and `window.location.search`; `BackgroundCanvas` then continues using one resolved boolean throughout its existing lifecycle.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library

## Global Constraints

- The override is active only when Vite reports development mode and the exact query value is `motion=full`.
- Production builds always respect `prefers-reduced-motion: reduce`, even if the query parameter is present.
- Add no visible control, persistence, dependency, Three.js API, or shader change.
- Preserve the existing static medium-density composition when the override is absent.

---

### Task 1: Resolve and Apply the Development Motion Override

**Files:**
- Modify: `src/components/BackgroundCanvas.tsx`
- Test: `src/components/BackgroundCanvas.test.tsx`

**Interfaces:**
- Consumes: `window.matchMedia("(prefers-reduced-motion: reduce)").matches`, `import.meta.env.DEV`, and `window.location.search`
- Produces: `resolveReducedMotion(prefersReducedMotion: boolean, isDevelopment: boolean, search: string): boolean`

- [ ] **Step 1: Add failing decision-helper tests**

Update the component import and add this test block before the component suite:

```ts
import { BackgroundCanvas, resolveReducedMotion } from "./BackgroundCanvas";

describe("resolveReducedMotion", () => {
  it("preserves the browser preference without an override", () => {
    expect(resolveReducedMotion(true, true, "")).toBe(true);
    expect(resolveReducedMotion(false, true, "")).toBe(false);
  });

  it("allows exact full motion only during development", () => {
    expect(resolveReducedMotion(true, true, "?motion=full")).toBe(false);
    expect(resolveReducedMotion(true, false, "?motion=full")).toBe(true);
  });

  it("rejects non-exact override values", () => {
    expect(resolveReducedMotion(true, true, "?motion=true")).toBe(true);
    expect(resolveReducedMotion(true, true, "?motion=FULL")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx
```

Expected: FAIL because `resolveReducedMotion` is not exported from `BackgroundCanvas.tsx`.

- [ ] **Step 3: Implement the minimal pure helper**

Add this export above `BackgroundCanvas`:

```ts
export function resolveReducedMotion(
  prefersReducedMotion: boolean,
  isDevelopment: boolean,
  search: string,
): boolean {
  const forcesFullMotion =
    isDevelopment && new URLSearchParams(search).get("motion") === "full";
  return prefersReducedMotion && !forcesFullMotion;
}
```

- [ ] **Step 4: Run the focused test and verify the helper is green**

Run:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx
```

Expected: PASS with the existing 14 component tests plus 3 helper tests.

- [ ] **Step 5: Add the failing component integration regression**

Reset the URL in `beforeEach` so query state cannot leak between tests:

```ts
window.history.replaceState({}, "", "/");
```

Then add this test after the existing reduced-motion test:

```ts
it("runs full motion in development when the URL override is present", () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList);
  window.history.replaceState({}, "", "/?motion=full");

  render(<BackgroundCanvas theme="dark" />);
  const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 1_000,
    height: 500,
  } as DOMRect);
  act(() => window.dispatchEvent(pointerMove(500, 250, 100)));

  expect(sceneMocks.createBackgroundScene).toHaveBeenCalledWith(
    canvas,
    expect.objectContaining({ staticQuality: undefined }),
  );
  expect(controller.start).toHaveBeenCalledOnce();
  expect(controller.renderStatic).not.toHaveBeenCalled();
  expect(controller.setPointer).toHaveBeenCalledWith(0, 0, 0);
});
```

- [ ] **Step 6: Run the focused test and verify the integration red state**

Run:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx
```

Expected: FAIL because `BackgroundCanvas` still uses the raw browser preference, creates a static medium scene, and never calls `start` or `setPointer`.

- [ ] **Step 7: Route the component through the helper**

Replace the reduced-motion initialization with:

```ts
const prefersReducedMotion =
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const reducedMotion = resolveReducedMotion(
  prefersReducedMotion,
  import.meta.env.DEV,
  window.location.search,
);
```

Do not change any later lifecycle branches; they already consume `reducedMotion` consistently.

- [ ] **Step 8: Run focused and full verification**

Run:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx
npm.cmd run verify
git diff --check
```

Expected: the component suite passes with 18 tests; the full suite, TypeScript build, Vite production build, SPA fallback, and diff hygiene all pass. The existing Vite large-chunk advisory may remain.

- [ ] **Step 9: Verify the live development override**

With the Vite server running on port 5174, open:

```text
http://localhost:5174/?motion=full
```

Expected: particles move and respond to mouse movement even when the browser reports reduced motion. Reloading `http://localhost:5174/` without the parameter returns to the static composition.

- [ ] **Step 10: Commit**

```powershell
git add -- src/components/BackgroundCanvas.tsx src/components/BackgroundCanvas.test.tsx
git commit -m "feat: add development motion override"
```
