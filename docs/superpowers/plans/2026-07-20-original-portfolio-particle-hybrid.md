# Original Portfolio with Constellation Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the original `b29b772` portfolio experience on the modern Vite/React foundation while retaining the reviewed constellation particle background.

**Architecture:** Start a new isolated branch/worktree from the preserved particle branch. Restore original content and media into typed modern components, then restore original shell, theme, transition, and responsive contracts around the unchanged particle renderer.

**Tech Stack:** React 19, TypeScript 7, React Router 7, Three.js 0.185, Vite 8, Sass, Vitest 4, Testing Library

## Global Constraints

- Commit `b29b772` is the exact source of truth for visible copy, project order and fields, media, links, widths, spacing, breakpoints, colors, navigation labels, footer copy, and interaction timing.
- Preserve the current particle renderer, shaders, pointer behavior, touch autonomy, quality budgets, reduced-motion static mode, `?motion=full` development override, lifecycle, fallback, and disposal behavior.
- Keep Vite/React/TypeScript; do not restore Gatsby 2 or generated legacy `public/` output.
- Default theme is dark. Exact original palette values are dark `#222/#ccc/#666/#444/#f44263` and white `#fff/#000/#aaa/#ccc/#880000`.
- Default content width is 600px; Works and project detail width is 900px; spacing is 1.5rem; breakpoints are 480px and 768px.
- Route transitions last 500ms and reverse direction for browser-back navigation. Media color reveal lasts 400ms.
- Preserve accessibility improvements only when they do not change visible appearance.
- Do not modify or clean the dirty main checkout. Execute from a new worktree rooted at the preserved particle branch.

---

### Task 1: Restore the Original Project Dataset and Media

**Files:**
- Modify: `src/data/projects.ts`
- Modify: `src/data/projects.test.ts`
- Modify: `src/data/projectMedia.test.ts`
- Add: `static/portfolio/webgl-minecraft.mp4`
- Add: `static/portfolio/flappy-pixie.mp4`
- Add: `static/portfolio/fitmed.png`
- Add: `static/portfolio/kiteprint.png`
- Delete: `static/portfolio/business-platforms.svg`
- Delete: `static/portfolio/document-ai.svg`
- Delete: `static/portfolio/e-invoicing-ksef.svg`
- Delete: `static/portfolio/mobile-applications.svg`
- Delete: `static/portfolio/warehouse-manufacturing.svg`

**Interfaces:**
- Produces: `Project`, `ProjectMedia`, `projects`, and `getProjectBySlug(slug: string): Project | undefined`
- Consumed by: `ProjectCard`, `ProjectMedia`, `WorksPage`, and `ProjectPage`

- [ ] **Step 1: Replace the data assertions with the original seven-entry contract**

Use one exact expected array in `src/data/projects.test.ts`:

```ts
const expectedProjects = [
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["javascript", "three.js", "webgl"], "April 2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/WebGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["javascript", "three.js", "webgl", "gltf"], "September 2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/Endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["javascript", "three.js", "webgl"], "October 2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/Flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["javascript", "three.js", "webgl"], "December 2018", "/portfolio/civio.mp4", "https://github.com/corashina/Civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["typescript", "three.js", "webgl", "glsl"], "February 2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/Particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype system for dieteticians", ["javascript", "react", "redux", "node", "express", "mongodb"], "July 2018", "/portfolio/fitmed.png", "https://github.com/corashina/Fitmed"],
  ["kiteprint", "Kiteprint", "Simple PSD to HTML", ["javscript", "react"], "September 2018", "/portfolio/kiteprint.png", "https://github.com/corashina/Kiteprint"],
] as const;

it("matches the original project dataset verbatim and in order", () => {
  expect(projects.map((project) => [
    project.slug,
    project.title,
    project.description,
    project.tools,
    project.date,
    project.media.src,
    project.sourceUrl,
  ])).toEqual(expectedProjects);
});
```

In `src/data/projectMedia.test.ts`, assert every `media.src` resolves beneath `static/portfolio` and exists using `existsSync(resolve("static", media.src.slice(1)))`.

- [ ] **Step 2: Run the data tests and verify the red state**

Run:

```powershell
npm.cmd test -- src/data/projects.test.ts src/data/projectMedia.test.ts
```

Expected: FAIL because the refreshed eight-entry dataset and five refreshed SVG assets do not match the original contract, while four original media files are absent.

- [ ] **Step 3: Implement the original typed dataset**

Replace the project types with:

```ts
export type ProjectMedia = {
  kind: "image" | "video";
  src: string;
  alt: string;
};

export type Project = {
  slug: string;
  title: string;
  description: string;
  tools: readonly string[];
  date: string;
  media: ProjectMedia;
  sourceUrl: string;
};
```

Build `projects` from the exact seven tuples in Step 1. Set `kind` from the filename extension and use these non-visible accessibility labels: `WebGL Minecraft scene`, `Infinite procedural WebGL city scene`, `Flappy Pixie game`, `Procedural hexagonal map`, `GLSL particle simulation`, `Fitmed interface`, and `Kiteprint interface`.

Keep:

```ts
export const getProjectBySlug = (slug: string): Project | undefined =>
  projects.find((project) => project.slug === slug);
```

- [ ] **Step 4: Restore and remove media assets**

Run from the hybrid worktree:

```powershell
git restore --source=b29b772 --worktree -- static/portfolio/webgl-minecraft.mp4 static/portfolio/flappy-pixie.mp4 static/portfolio/fitmed.png static/portfolio/kiteprint.png
```

Delete the five refreshed SVG files with `apply_patch` for text SVGs. Retain the existing original `civio.mp4`, `endless-city.mp4`, and `particle-simulation.mp4`.

- [ ] **Step 5: Run the data tests and commit**

Run:

```powershell
npm.cmd test -- src/data/projects.test.ts src/data/projectMedia.test.ts
git diff --check
```

Expected: PASS with seven exact entries and all seven media files present.

Commit:

```powershell
git add -- src/data/projects.ts src/data/projects.test.ts src/data/projectMedia.test.ts static/portfolio
git commit -m "feat: restore original project data and media"
```

---

### Task 2: Restore the Original Home, Contact, and 404 Content

**Files:**
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/HomePage.test.tsx`
- Modify: `src/pages/ContactPage.tsx`
- Modify: `src/pages/NotFoundPage.tsx`
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/styles/home.module.scss`
- Modify: `src/styles/contact.module.scss`
- Delete: `src/components/Skills.tsx`
- Delete: `src/data/skills.ts`

**Interfaces:**
- Consumes: the existing shell and routes
- Produces: exact original visible content for Home, Contact, and 404

- [ ] **Step 1: Add failing exact-copy tests**

Replace the homepage expectations with:

```ts
const paragraphs = [
  "Web enthusiast with experience in software development and architecture. Interested in network programming, web-based architecture, web-based authentication and unix systems. Advocate of fast paced development environments that embrace continuous change. Student at the University of Southampton.",
  "Accomplishing my goals with a variety of tools, predominantly web stuff such as Javascript, React, Redux, Node. Always ready to grasp new concepts and learn different technologies.",
];

it("renders the original homepage verbatim", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1, name: "Tomasz Zielinski" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 2, name: "an aspiring software engineer" })).toBeInTheDocument();
  paragraphs.forEach((copy) => expect(screen.getByText(copy)).toBeInTheDocument());
  expect(screen.getByRole("heading", { level: 2, name: "i use" })).toBeInTheDocument();
  expect(screen.getByLabelText("Technologies")).toHaveTextContent("javascript typescript scss three react redux gatsby node nosql mongo");
});
```

Extend `AppShell.test.tsx` to assert the original Contact destinations, `http://twitter.com/corashina`, Stack Exchange flair, résumé path, and footer text remain exact.

- [ ] **Step 2: Run page tests and verify the red state**

Run:

```powershell
npm.cmd test -- src/pages/HomePage.test.tsx src/components/AppShell.test.tsx src/app/App.test.tsx
```

Expected: FAIL on refreshed homepage copy, grouped skills, and the non-original Twitter URL.

- [ ] **Step 3: Implement the original homepage structure**

Use this component structure:

```tsx
const tools = ["javascript", "typescript", "scss", "three", "", "react", "redux", "gatsby", "", "node", "nosql", "mongo"];

export function HomePage(): JSX.Element {
  return (
    <>
      <h1>Tomasz Zielinski</h1>
      <div className={styles.home}>
        <div>
          <h2>an aspiring software engineer</h2>
          <p>Web enthusiast with experience in software development and architecture. Interested in network programming, web-based architecture, web-based authentication and unix systems. Advocate of fast paced development environments that embrace continuous change. Student at the University of Southampton.</p>
          <p>Accomplishing my goals with a variety of tools, predominantly web stuff such as Javascript, React, Redux, Node. Always ready to grasp new concepts and learn different technologies.</p>
        </div>
        <div className={styles.tools}>
          <h2>i use</h2>
          <p aria-label="Technologies">{tools.map((tool, index) => <Fragment key={`${tool}-${index}`}>{tool}<br /></Fragment>)}</p>
        </div>
      </div>
    </>
  );
}
```

Import `Fragment`. Delete the refreshed `Skills` component and grouped-skill data.

- [ ] **Step 4: Restore the original supporting page details and styles**

Set the Contact Twitter URL to `http://twitter.com/corashina`. Keep semantic labels and icon hiding because they do not alter appearance. Preserve the original 404 heading/content currently represented by `NotFoundPage`.

Replace `home.module.scss` with:

```scss
@use "themes" as *;

.home {
  display: grid;
  column-gap: 1rem;
}

.tools,
.tools p {
  text-align: right;
}

@media (min-width: $media-sm) {
  .home {
    grid-template-columns: 2fr 1fr;
  }
}
```

Keep the original Contact list and flair geometry: icon size 16px and `.flair { position: relative; left: 50%; }`.

- [ ] **Step 5: Run page tests and commit**

Run:

```powershell
npm.cmd test -- src/pages/HomePage.test.tsx src/components/AppShell.test.tsx src/app/App.test.tsx
git diff --check
```

Expected: PASS with original visible copy and destinations.

Commit:

```powershell
git add -- src/pages src/components/Skills.tsx src/data/skills.ts src/components/AppShell.test.tsx src/styles/home.module.scss src/styles/contact.module.scss
git commit -m "feat: restore original portfolio copy"
```

---

### Task 3: Restore Original Works Cards and Project Details

**Files:**
- Modify: `src/components/ProjectCard.tsx`
- Modify: `src/components/ProjectMedia.tsx`
- Modify: `src/pages/WorksPage.tsx`
- Modify: `src/pages/WorksPage.test.tsx`
- Modify: `src/pages/ProjectPage.tsx`
- Modify: `src/pages/ProjectPage.test.tsx`
- Modify: `src/styles/work.module.scss`

**Interfaces:**
- Consumes: `Project` and `projects` from Task 1
- Produces: original Works grid, media behavior, and project-detail presentation

- [ ] **Step 1: Add failing Works and detail tests**

Update `WorksPage.test.tsx` to assert:

```ts
expect(screen.getByRole("heading", { level: 2, name: "my stuff" })).toBeInTheDocument();
expect(screen.getAllByRole("link")).toHaveLength(7);
expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
  "/works/webgl-minecraft",
  "/works/endless-city",
  "/works/flappy-pixie",
  "/works/civio",
  "/works/particle-simulation",
  "/works/fitmed",
  "/works/kiteprint",
]);
```

Retain the existing play/pause/reset test, targeting `Endless-City`. Extend it to render a project detail and verify hover play plus leave pause/reset there too.

Replace detail assertions with:

```ts
it("renders the original project fields", () => {
  renderProject("webgl-minecraft");
  expect(screen.getByRole("heading", { level: 2, name: "WebGL-Minecraft" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 4, name: "April 2018" })).toBeInTheDocument();
  expect(screen.getByText("Primitive minecraft clone made with three.js")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["javascript", "three.js", "webgl"]);
  expect(screen.getByRole("link", { name: "github →" })).toHaveAttribute("href", "https://github.com/corashina/WebGL-Minecraft");
});
```

- [ ] **Step 2: Run focused tests and verify the red state**

Run:

```powershell
npm.cmd test -- src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx
```

Expected: FAIL on refreshed heading, eight-card layout, contribution sections, and non-interactive detail media.

- [ ] **Step 3: Implement original Works/card markup**

Use `my stuff` as the Works subtitle. Render each card as one link with the media and visible title inside the bordered card:

```tsx
export function ProjectCard({ project }: ProjectCardProps): JSX.Element {
  return (
    <Link aria-label={project.title} className={styles.card} to={`/works/${project.slug}`}>
      <ProjectMedia interactive media={project.media} />
      <span>{project.title}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Implement original project-detail markup**

Use:

```tsx
<article className={styles.detail}>
  <ProjectMedia interactive media={project.media} />
  <div>
    <h2>{project.title}</h2>
    <h4>{project.date}</h4>
    <p>{project.description}</p>
    <br />
    <ul className={styles.tools}>{project.tools.map((tool) => <li key={tool}>{tool}</li>)}</ul>
    <br />
    <a href={project.sourceUrl}>github →</a>
  </div>
</article>
```

Retain the unknown-slug 404 path. Keep the existing media error fallback and reduced-motion play suppression.

- [ ] **Step 5: Restore the original Works CSS contract**

Set the grid to one column by default, two at 480px, and three at 768px. Cards use a 1px `$color-25` border and 5px padding; hover/focus changes only the border/accent and media filter. Detail uses `gap: 2rem` and `grid-template-columns: 2fr 1fr` from 480px. Tool tags use `$color-2`, a 1px `$color-2` border, horizontal padding `$spacing / 10`, right margin `$spacing / 5`, and bottom margin `$spacing / 5`.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm.cmd test -- src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx
git diff --check
```

Expected: PASS for exact order, links, detail fields, media behavior, 404, and fallback.

Commit:

```powershell
git add -- src/components/ProjectCard.tsx src/components/ProjectMedia.tsx src/pages/WorksPage.tsx src/pages/WorksPage.test.tsx src/pages/ProjectPage.tsx src/pages/ProjectPage.test.tsx src/styles/work.module.scss
git commit -m "feat: restore original work presentation"
```

---

### Task 4: Restore Original Themes, Shell, and Directional Transitions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/components/AppShell.tsx`
- Modify: `src/components/AppShell.test.tsx`
- Modify: `src/components/Navigation.tsx`
- Modify: `src/theme/theme.ts`
- Modify: `src/theme/theme.test.ts`
- Modify: `src/styles/themes.scss`
- Modify: `src/styles/global.scss`
- Modify: `src/styles/layout.module.scss`
- Modify: `src/styles/contrast.test.ts`

**Interfaces:**
- Consumes: routes from `App`, `BackgroundCanvas(theme)`, and original page components
- Produces: dark-first theme state, original navigation/footer geometry, coordinated particle palette, and 500ms forward/back transitions

- [ ] **Step 1: Add failing theme and transition-policy tests**

Replace persistence/system-preference expectations with:

```ts
it("always starts with the original dark theme", () => {
  localStorage.setItem("portfolio-theme", "white");
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  expect(document.body).toHaveClass("dark");
});

it("toggles page and particle themes together without persistence", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/"]}><App /></MemoryRouter>);
  const controller = sceneMocks.createBackgroundScene.mock.results[0]?.value;
  await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
  expect(document.body).toHaveClass("white");
  expect(controller.setTheme).toHaveBeenLastCalledWith(expect.objectContaining({ background: "#ffffff" }));
  expect(localStorage.getItem("portfolio-theme")).not.toBe("white");
});
```

Export and test:

```ts
export type TransitionDirection = "forward" | "backward";

export const resolveTransitionDirection = (
  navigationType: NavigationType,
  locationKey: string,
): TransitionDirection =>
  navigationType === "POP" && locationKey !== "default" ? "backward" : "forward";
```

Expect initial `POP/default` and `PUSH` to be forward, and later `POP/non-default` to be backward.

- [ ] **Step 2: Add failing exact-style contract assertions**

In `src/styles/contrast.test.ts`, replace refreshed contrast substitutions with source-contract assertions for:

```ts
expect(themes).toContain("--color-bg: #222");
expect(themes).toContain("--color-1: #ccc");
expect(themes).toContain("--color-2: #666");
expect(themes).toContain("--color-25: #444");
expect(themes).toContain("--color-3: #f44263");
expect(themes).toContain("--color-bg: #fff");
expect(layout).toContain("max-width: 600px");
expect(layout).toContain("max-width: 900px");
expect(layout).toContain("margin-bottom: 5rem");
expect(layout).toContain("500ms");
expect(layout).toContain("50vw");
expect(global).toContain("400ms");
```

- [ ] **Step 3: Run shell/theme tests and verify the red state**

Run:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx src/theme/theme.test.ts src/styles/contrast.test.ts
```

Expected: FAIL because stored/system themes override dark, transition direction is absent, and accessible replacement colors differ from the original palette.

- [ ] **Step 4: Add modern transition support**

Run:

```powershell
npm.cmd install react-transition-group@4.4.5
npm.cmd install --save-dev @types/react-transition-group@4.4.12
```

Use `useOutlet`, `useLocation`, `useNavigationType`, `TransitionGroup`, and `CSSTransition`. Create a new node ref per `location.key`, choose forward/backward class maps from `resolveTransitionDirection`, and render the captured outlet inside one `<main>` per transition child. Use `timeout={500}` and `unmountOnExit`.

The route stage is a one-cell CSS grid so entering and exiting pages occupy the same cell without changing the shell width.

- [ ] **Step 5: Restore original dark-first theme and exact palettes**

Initialize `theme` with `useState<Theme>("dark")`. Remove local-storage/system-preference reads and writes from `AppShell`; keep `applyTheme(theme, document.body)` and pass the same theme to `BackgroundCanvas`.

Reduce `src/theme/theme.ts` to:

```ts
export type Theme = "dark" | "white";

export function applyTheme(theme: Theme, root: HTMLElement): void {
  root.classList.remove("dark", "white");
  root.classList.add(theme);
  root.style.colorScheme = theme === "white" ? "light" : "dark";
}
```

Restore the exact five CSS variables for each theme. Alias any internal muted/accent variable to `var(--color-2)` and `var(--color-3)` without introducing replacement hex values.

- [ ] **Step 6: Restore transition and shell geometry**

Implement forward enter from `translateX(50vw)`, forward exit to `translateX(-50vw)`, backward enter from `translateX(-50vw)`, and backward exit to `translateX(50vw)`, all with opacity and 500ms ease-in/ease-out timing. Preserve reduced-motion rules by disabling transition duration and transforms.

Keep the current semantic mobile-menu button, auto-close on navigation, original labels `Home`, `Work`, `Contact`, original active muted color, 600/900px widths, 1.5rem padding token, navigation border, and 5rem separation.

- [ ] **Step 7: Run shell/theme tests, full verification, and commit**

Run:

```powershell
npm.cmd test -- src/components/AppShell.test.tsx src/theme/theme.test.ts src/styles/contrast.test.ts src/components/BackgroundCanvas.test.tsx
npm.cmd run verify
git diff --check
```

Expected: all tests, TypeScript, Vite build, SPA fallback, existing particle suites, and diff hygiene pass. The existing large-chunk advisory may remain.

Commit:

```powershell
git add -- package.json package-lock.json src/components/AppShell.tsx src/components/AppShell.test.tsx src/components/Navigation.tsx src/theme src/styles
git commit -m "feat: restore original shell and transitions"
```

---

### Task 5: Acceptance Verification and Browser Review

**Files:**
- Add: `.superpowers/sdd/hybrid-verification-report.md`
- Modify source or test files only if verification exposes a spec gap; every correction requires a failing focused test first.

**Interfaces:**
- Consumes: all completed tasks and the unchanged particle subsystem
- Produces: evidence that the original presentation and reviewed particle background work together

- [ ] **Step 1: Run the complete automated gate**

Run:

```powershell
npm.cmd run verify
git diff --check
git status --short
```

Expected: zero test failures, successful TypeScript and production build, generated SPA fallback, no whitespace errors, and no uncommitted files.

- [ ] **Step 2: Run the local hybrid preview**

Start Vite on an unused strict port and open the forced-motion URL:

```text
http://localhost:5174/?motion=full
```

- [ ] **Step 3: Verify desktop behavior**

At 1440x900 verify Home, Works, every project detail, Contact, and 404 in both themes. Confirm exact original copy, seven projects, 600/900px widths, Questrial typography, borders, spacing, footer, grayscale reveal, video play/pause/reset, mobile-menu absence, forward/back transitions, particle motion, pointer response, theme palette interpolation, text readability, and clean console.

- [ ] **Step 4: Verify mobile and reduced-motion behavior**

At 390x844 verify the expandable menu, one-column Works/detail layouts, no horizontal overflow, static medium-density constellation without `motion=full`, and animated constellation with the override. Confirm touch scrolling does not energize the field.

- [ ] **Step 5: Record and commit the verification evidence**

Write the browser and command evidence to `.superpowers/sdd/hybrid-verification-report.md`. If a source correction was needed, first follow a focused red-green cycle, rerun the complete automated and browser gates, and include the exact corrected source and test paths in the same commit.

```powershell
git add -- .superpowers/sdd/hybrid-verification-report.md
git commit -m "docs: verify original portfolio hybrid"
```
