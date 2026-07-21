# Unified Width and Always-On Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every route the Work section's 900px shell width and make particle, route, media, and video-preview motion work by default without a URL override.

**Architecture:** Keep width policy in the shared `AppShell`/layout stylesheet rather than individual pages. Remove the independent reduced-motion and query-override branches from route, canvas, and project-media integrations so all animated subsystems follow one always-on policy while retaining visibility pause/resume and media cleanup behavior.

**Tech Stack:** React 19, React Router, TypeScript, SCSS modules, Three.js, Vitest, Testing Library.

## Global Constraints

- Every route uses a fluid shell with a `900px` maximum width.
- No code reads or preserves `?motion=full`.
- Particle animation, 500ms route slide/fade transitions, media reveal transitions, and project video previews remain enabled regardless of `prefers-reduced-motion`.
- Video previews pause and reset to time zero on pointer leave or focus loss.
- Existing mobile grids, theme behavior, visibility pause/resume, fallback handling, and route direction behavior remain unchanged.

---

### Task 1: Stabilize the Shared Shell Width

**Files:**
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/styles/contrast.test.ts`
- Modify: `src/styles/layout.module.scss`

**Interfaces:**
- Consumes: `AppShell` route rendering and the existing `styles.layout` class.
- Produces: one route-independent `styles.layout` shell capped at `900px`; no `workLayout` class.

- [x] **Step 1: Write failing layout tests**

Replace the query-specific `fullMotion` tests in `AppShell.test.tsx` with a navigation assertion that the shell class does not change between Home and Work:

```tsx
it("keeps the shared shell class stable between Home and Work", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
  const initialClassName = container.firstElementChild?.className;

  await user.click(screen.getByRole("link", { name: "Work" }));

  expect(container.firstElementChild).toHaveClass(styles.layout);
  expect(container.firstElementChild?.className).toBe(initialClassName);
});
```

Update `contrast.test.ts` to require the new shell contract:

```ts
expect(findBlock(layout, ".layout")).toMatch(/max-width: 900px;/);
expect(layout).not.toMatch(/\.workLayout\s*\{/);
```

- [x] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx src/styles/contrast.test.ts
```

Expected: FAIL because Work still adds `workLayout`, Home is capped at `600px`, and the query-specific classes still exist.

- [x] **Step 3: Implement the stable shell**

In `AppShell.tsx`, remove `isWorkRoute`, `fullMotionRef`, `fullMotion`, and all conditional shell classes. Render:

```tsx
<div className={styles.layout}>
```

In `layout.module.scss`, set:

```scss
.layout {
  display: grid;
  margin: auto;
  max-width: 900px;
  padding: 0 $spacing;
}
```

Delete the `.workLayout` rule.

- [x] **Step 4: Run tests and verify GREEN**

Run the Task 1 test command. Expected: both files pass.

- [x] **Step 5: Commit**

```powershell
git add -- src/components/AppShell.test.tsx src/components/AppShell.tsx src/styles/contrast.test.ts src/styles/layout.module.scss
git commit -m "fix: keep portfolio shell width stable"
```

---

### Task 2: Make Route and Particle Motion Always On

**Files:**
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/components/BackgroundCanvas.test.tsx`
- Modify: `src/components/BackgroundCanvas.tsx`
- Modify: `src/styles/contrast.test.ts`
- Modify: `src/styles/global.scss`
- Modify: `src/styles/layout.module.scss`
- Modify: `src/styles/work.module.scss`

**Interfaces:**
- Consumes: `createBackgroundScene`, its `BackgroundController`, and existing route transition classes.
- Produces: an always-animated canvas controller and unconditional 500ms route/media CSS transitions; removes `resolveReducedMotion`.

- [x] **Step 1: Write failing always-on motion tests**

Delete the `resolveReducedMotion` test group and replace the reduced-motion canvas test with:

```tsx
it("keeps animation and pointer interaction enabled when reduced motion is reported", () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
  render(<BackgroundCanvas theme="dark" />);
  const canvas = screen.getByTestId("background-canvas") as HTMLCanvasElement;
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, width: 1_000, height: 500,
  } as DOMRect);

  act(() => window.dispatchEvent(pointerMove(500, 250, 100)));

  expect(sceneMocks.createBackgroundScene).toHaveBeenCalledWith(
    canvas,
    expect.not.objectContaining({ staticQuality: "medium" }),
  );
  expect(controller.start).toHaveBeenCalledOnce();
  expect(controller.renderStatic).not.toHaveBeenCalled();
  expect(controller.setPointer).toHaveBeenCalledWith(0, 0, 0);
});
```

Remove query-override tests from `AppShell.test.tsx`. In `contrast.test.ts`, assert that `layout`, `global`, and `work` contain no `@media (prefers-reduced-motion: reduce)` blocks.

- [x] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test -- src/components/BackgroundCanvas.test.tsx src/components/AppShell.test.tsx src/styles/contrast.test.ts
```

Expected: FAIL because reduced motion still creates a static canvas and three stylesheets still suppress transitions.

- [x] **Step 3: Remove motion branching**

In `BackgroundCanvas.tsx`:

- Remove the `resolveReducedMotion` export and `reducedMotionRef`.
- Remove `matchMedia`, `URLSearchParams`, and `staticQuality` selection.
- Always process non-touch pointer movement.
- On visible documents, call `controller.start()`.
- Remove all conditional `renderStatic()` calls from resize and theme updates.

Delete the reduced-motion media queries from `layout.module.scss`, `global.scss`, and `work.module.scss`. Preserve the existing 500ms route and 400ms media transition declarations.

- [x] **Step 4: Run tests and verify GREEN**

Run the Task 2 test command. Expected: all selected tests pass.

- [x] **Step 5: Commit**

```powershell
git add -- src/components/AppShell.test.tsx src/components/BackgroundCanvas.test.tsx src/components/BackgroundCanvas.tsx src/styles/contrast.test.ts src/styles/global.scss src/styles/layout.module.scss src/styles/work.module.scss
git commit -m "feat: make portfolio motion always on"
```

---

### Task 3: Restore Project Video Hover Playback

**Files:**
- Modify: `src/pages/WorksPage.test.tsx`
- Modify: `src/components/ProjectMedia.tsx`

**Interfaces:**
- Consumes: the project-card link surrounding `ProjectMedia` and `HTMLVideoElement.play`, `pause`, and `currentTime`.
- Produces: hover/focus playback with leave/blur pause-and-reset regardless of OS motion preference.

- [x] **Step 1: Write the failing playback regression**

Replace the test that expects reduced motion to suppress playback with:

```tsx
it("plays video previews even when reduced motion is reported", async () => {
  setReducedMotion(true);
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  renderPage();

  const card = screen.getByRole("link", { name: "Endless-City" });
  fireEvent.mouseEnter(card);
  fireEvent.focus(card);
  await Promise.resolve();

  expect(play).toHaveBeenCalledTimes(2);
});
```

Keep the existing hover/focus and pause/reset test unchanged.

- [x] **Step 2: Run the test and verify RED**

Run:

```powershell
npm.cmd test -- src/pages/WorksPage.test.tsx
```

Expected: FAIL because `ProjectMedia` returns before `video.play()` when `matchMedia` reports reduced motion.

- [x] **Step 3: Implement unconditional preview playback**

Replace the `play` handler in `ProjectMedia.tsx` with:

```ts
const play = () => {
  video.play()?.catch(() => {});
};
```

Keep existing event attachment, rejected-promise handling, cleanup, pause, and reset behavior.

- [x] **Step 4: Run the test and verify GREEN**

Run the Task 3 test command. Expected: all Works page tests pass.

- [x] **Step 5: Run the complete verification gate**

```powershell
npm.cmd run verify
git diff --check
```

Expected: all Vitest files pass, TypeScript succeeds, Vite builds successfully, and `git diff --check` exits zero. The existing Vite large-chunk advisory is non-blocking.

- [x] **Step 6: Commit**

```powershell
git add -- src/pages/WorksPage.test.tsx src/components/ProjectMedia.tsx
git commit -m "fix: restore project video hover playback"
```
