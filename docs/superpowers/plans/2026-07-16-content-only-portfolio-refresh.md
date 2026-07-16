# Content-only Portfolio Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the portfolio introduction and skills, add four projects for a twelve-project collection, and preserve the current visual design and behavior.

**Architecture:** Keep every component and style module unchanged. Update the existing copy and typed data sources, add four local media files that use the current `ProjectMedia` interface, and strengthen the existing Vitest coverage around exact content, privacy, project routing, and local media.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, static SVG/PNG media

## Global Constraints

- Work only in `C:\Users\Tomasz\Documents\Projects\corashina.github.io\.worktrees\content-only-refresh` on `codex/content-only-refresh`.
- Do not change components, JSX structure, stylesheets, CSS classes, layout, spacing, widths, typography, colors, breakpoints, routing, navigation, animations, shaders, theme behavior, or interactions.
- Do not add company names, customer names, job titles, employment history, dates, or timelines.
- Do not publish internal repository names, internal URLs, credentials, private prompts, customer data, or implementation details that expose private systems.
- Preserve every existing project record, link, and media asset.
- Modify production code only in `src/pages/HomePage.tsx`, `src/data/skills.ts`, and `src/data/projects.ts`.
- Add exactly `static/portfolio/shared-ui-components.svg`, `static/portfolio/erp-integration-tooling.svg`, `static/portfolio/webgl-minecraft.png`, and `static/portfolio/points-in-country.svg`.
- Keep public media local at runtime; do not add packages or remote application dependencies.
- Use the approved copy and project order exactly.

## File Structure

- Modify `src/pages/HomePage.tsx`: replace the two introduction paragraphs without changing their JSX structure.
- Modify `src/data/skills.ts`: expand the arrays in the existing five skill groups.
- Modify `src/data/projects.ts`: insert four `Project` records into the approved positions.
- Modify `src/pages/HomePage.test.tsx`: lock the exact introduction and skills.
- Modify `src/data/projects.test.ts`: lock project count, order, new records, privacy, and five public links.
- Modify `src/data/projectMedia.test.ts`: require the four new local files and preserve private-SVG checks.
- Modify `src/pages/WorksPage.test.tsx`: require twelve semantic project links.
- Modify `src/pages/ProjectPage.test.tsx`: require source links for the five approved public projects only.
- Create `static/portfolio/shared-ui-components.svg`: privacy-safe component-library illustration.
- Create `static/portfolio/erp-integration-tooling.svg`: privacy-safe integration-node illustration.
- Create `static/portfolio/webgl-minecraft.png`: authentic preview copied from the public repository.
- Create `static/portfolio/points-in-country.svg`: coordinate-grid illustration.

---

### Task 1: Update the introduction and skill groups

**Files:**
- Modify: `src/pages/HomePage.test.tsx:5-45`
- Modify: `src/pages/HomePage.tsx:10-23`
- Modify: `src/data/skills.ts:6-40`

**Interfaces:**
- Consumes: `HomePage`, the existing `Skills` component, and `skillGroups: readonly SkillGroup[]`.
- Produces: the approved two-paragraph introduction and five skill groups through the existing DOM and data interfaces.

- [ ] **Step 1: Replace the expected home copy and skill arrays in the test**

Replace `approvedParagraphs` and `approvedSkillGroups` in `src/pages/HomePage.test.tsx` with:

```tsx
const approvedParagraphs = [
  "I build web and mobile applications for operations, approvals, document processing, and ERP-connected workflows. My work spans React and TypeScript interfaces, reusable component systems, native mobile clients, .NET services, and automation tooling.",
  "I focus on software that turns complex business rules into clear, reliable tools—from scanner-led warehouse processes and editable document workflows to e-invoicing, integrations, and WebGL experiments.",
];

const approvedSkillGroups = [
  {
    name: "Frontend",
    skills: [
      "TypeScript",
      "JavaScript",
      "React",
      "Redux Toolkit",
      "TanStack Query",
      "TanStack Table",
      "Three.js",
      "WebGL",
      "Mantine",
      "Material UI",
      "Sass",
      "Tailwind CSS",
      "Vite",
      "Storybook",
    ],
  },
  {
    name: "Backend & Integration",
    skills: [".NET", "C#", "Node.js", "REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    name: "Mobile",
    skills: ["React Native", "Expo", "Flutter", "React Navigation", "EAS Build"],
  },
  {
    name: "Data & Documents",
    skills: [
      "KSeF",
      "XML",
      "XSLT",
      "PDF workflows",
      "JSON",
      "Document AI",
      "dynamic forms",
    ],
  },
  {
    name: "Delivery",
    skills: [
      "GitHub Actions",
      "CI/CD",
      "npm publishing",
      "Vitest",
      "Testing Library",
      "Playwright",
      "accessibility testing",
    ],
  },
];
```

- [ ] **Step 2: Run the focused test and confirm the new expectations fail**

Run:

```powershell
npm.cmd test -- src/pages/HomePage.test.tsx
```

Expected: FAIL because the rendered paragraphs still start with `I build web and mobile software` and the current skill lists lack entries such as `TanStack Table`, `Storybook`, `React Navigation`, and `Playwright`.

- [ ] **Step 3: Replace only the two paragraph text nodes in `HomePage.tsx`**

Keep the existing fragment, headings, divs, classes, `Skills` component, and paragraph elements. Replace only their text with:

```tsx
          <p>
            I build web and mobile applications for operations, approvals, document processing,
            and ERP-connected workflows. My work spans React and TypeScript interfaces, reusable
            component systems, native mobile clients, .NET services, and automation tooling.
          </p>
          <p>
            I focus on software that turns complex business rules into clear, reliable tools—from
            scanner-led warehouse processes and editable document workflows to e-invoicing,
            integrations, and WebGL experiments.
          </p>
```

- [ ] **Step 4: Replace the skill data while retaining the existing five-group structure**

Set `skillGroups` in `src/data/skills.ts` to:

```ts
export const skillGroups: readonly SkillGroup[] = [
  {
    name: "Frontend",
    skills: [
      "TypeScript",
      "JavaScript",
      "React",
      "Redux Toolkit",
      "TanStack Query",
      "TanStack Table",
      "Three.js",
      "WebGL",
      "Mantine",
      "Material UI",
      "Sass",
      "Tailwind CSS",
      "Vite",
      "Storybook",
    ],
  },
  {
    name: "Backend & Integration",
    skills: [".NET", "C#", "Node.js", "REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    name: "Mobile",
    skills: ["React Native", "Expo", "Flutter", "React Navigation", "EAS Build"],
  },
  {
    name: "Data & Documents",
    skills: [
      "KSeF",
      "XML",
      "XSLT",
      "PDF workflows",
      "JSON",
      "Document AI",
      "dynamic forms",
    ],
  },
  {
    name: "Delivery",
    skills: [
      "GitHub Actions",
      "CI/CD",
      "npm publishing",
      "Vitest",
      "Testing Library",
      "Playwright",
      "accessibility testing",
    ],
  },
];
```

- [ ] **Step 5: Run the focused test and full suite**

Run:

```powershell
npm.cmd test -- src/pages/HomePage.test.tsx
npm.cmd test
```

Expected: the focused test passes, then all 63 tests pass.

- [ ] **Step 6: Confirm the task changed only its three approved files**

Run:

```powershell
git status --short
git diff --check
git diff -- src/pages/HomePage.tsx src/data/skills.ts src/pages/HomePage.test.tsx
```

Expected: only the three Task 1 files appear; `git diff --check` prints nothing.

- [ ] **Step 7: Commit the home and skills update**

```powershell
git add -- src/pages/HomePage.tsx src/data/skills.ts src/pages/HomePage.test.tsx
git commit -m "feat: refresh portfolio introduction and skills"
```

---

### Task 2: Add four projects and their local media

**Files:**
- Modify: `src/data/projects.test.ts:4-225`
- Modify: `src/data/projectMedia.test.ts:3-24`
- Modify: `src/pages/WorksPage.test.tsx:27-47`
- Modify: `src/pages/ProjectPage.test.tsx:35-56`
- Modify: `src/data/projects.ts:19-190`
- Create: `static/portfolio/shared-ui-components.svg`
- Create: `static/portfolio/erp-integration-tooling.svg`
- Create: `static/portfolio/webgl-minecraft.png`
- Create: `static/portfolio/points-in-country.svg`

**Interfaces:**
- Consumes: the existing `Project` and `ProjectMedia` types, `projects`, `getProjectBySlug`, `ProjectCard`, `ProjectPage`, and `/portfolio/*` static-file convention.
- Produces: twelve unique `Project` records in the approved order, two generalized private projects, two linked public projects, and four local media files.

- [ ] **Step 1: Extend the project-data tests with exact order and exact new records**

After `recentProjects` in `src/data/projects.test.ts`, add:

```ts
const newProjectSlugs = [
  "shared-ui-components",
  "erp-integration-tooling",
  "webgl-minecraft",
  "points-in-country",
];

const newProjects = projects.filter((project) =>
  newProjectSlugs.includes(project.slug),
);

const privateProjects = projects.filter((project) => !project.sourceUrl);
const privateProjectText = privateProjects
  .map((project) => JSON.stringify(project).toLowerCase())
  .join(" ");
```

Remove the old `recentProjectText` declaration because the privacy assertions below now use `privateProjectText`.

Replace the eight-project test with:

```ts
  it("contains twelve unique projects in the approved order", () => {
    expect(projects).toHaveLength(12);
    expect(new Set(projects.map((project) => project.slug)).size).toBe(12);
    expect(projects.map((project) => project.slug)).toEqual([
      "warehouse-manufacturing-workflows",
      "business-platforms-approvals",
      "shared-ui-components",
      "erp-integration-tooling",
      "e-invoicing-ksef",
      "document-ai",
      "mobile-applications",
      "endless-city",
      "webgl-minecraft",
      "particle-simulation",
      "civio",
      "points-in-country",
    ]);
  });
```

Add this test after the existing exact recent-project test:

```ts
  it("matches the four approved new project records exactly", () => {
    expect(newProjects).toEqual([
      {
        slug: "shared-ui-components",
        title: "Shared UI Components",
        summary: "Reusable React controls, responsive tables, documentation, and package delivery.",
        overview:
          "A reusable React component library for consistent product interfaces. It combines Mantine controls with responsive TanStack tables, Storybook documentation, accessibility checks, Vite library builds, and npm packaging.",
        contributions: [
          "Built reusable form controls and responsive data-table components.",
          "Documented component states and usage in Storybook.",
          "Added unit, browser, and accessibility checks to the package workflow.",
        ],
        technologies: [
          "React",
          "TypeScript",
          "Mantine",
          "TanStack Table",
          "Storybook",
          "Vite",
          "Vitest",
          "Playwright",
        ],
        media: {
          kind: "image",
          src: "/portfolio/shared-ui-components.svg",
          alt: "Reusable interface components and responsive data table",
        },
      },
      {
        slug: "erp-integration-tooling",
        title: "ERP Integration Tooling",
        summary: "Typed n8n nodes for credentials, REST orchestration, and ERP workflows.",
        overview:
          "Integration tooling that connects automation workflows to Oracle JD Edwards through typed custom n8n nodes. It covers credential configuration, REST request orchestration, node metadata, package builds, and npm delivery.",
        contributions: [
          "Built typed n8n nodes for Oracle JD Edwards orchestration endpoints.",
          "Implemented credential handling and configurable REST request flows.",
          "Prepared build, lint, and package tooling for repeatable delivery.",
        ],
        technologies: [
          "TypeScript",
          "Node.js",
          "n8n",
          "REST APIs",
          "Oracle JD Edwards",
          "npm",
        ],
        media: {
          kind: "image",
          src: "/portfolio/erp-integration-tooling.svg",
          alt: "Automation nodes connected to an ERP service",
        },
      },
      {
        slug: "webgl-minecraft",
        title: "WebGL Minecraft",
        summary: "A voxel world with movement, collisions, and generated terrain.",
        overview:
          "A public Three.js voxel-world experiment with pointer-lock controls, collision detection, block selection, and simple infinite terrain generation.",
        contributions: [
          "Built first-person movement and pointer-lock controls.",
          "Added terrain collisions and selectable block types.",
          "Generated simple terrain as the player moves through the world.",
        ],
        technologies: ["JavaScript", "Three.js", "WebGL", "procedural generation"],
        media: {
          kind: "image",
          src: "/portfolio/webgl-minecraft.png",
          alt: "Voxel terrain in the WebGL Minecraft experiment",
        },
        sourceUrl: "https://github.com/corashina/WebGL-Minecraft",
        sourceLabel: "GitHub",
      },
      {
        slug: "points-in-country",
        title: "points-in-country",
        summary: "Coordinate grids generated inside 206 country boundaries.",
        overview:
          "A public npm package that generates arrays of coordinates inside country boundaries. It includes boundary data for 206 countries and a configurable interval for controlling grid density.",
        contributions: [
          "Built coordinate-grid generation within country boundaries.",
          "Packaged boundary data for 206 countries.",
          "Published a configurable interval for controlling point density.",
        ],
        technologies: ["JavaScript", "Node.js", "geospatial data", "npm"],
        media: {
          kind: "image",
          src: "/portfolio/points-in-country.svg",
          alt: "Coordinate grid clipped to a country boundary",
        },
        sourceUrl: "https://github.com/corashina/points-in-country",
        sourceLabel: "GitHub",
      },
    ]);
  });
```

Change the contribution assertion so all private work receives the stronger check:

```ts
    expect(
      privateProjects.every((project) => project.contributions.length >= 3),
    ).toBe(true);
```

In the URL, date, metric, and organization tests, replace `recentProjectText` with `privateProjectText`, and replace the source assertions with:

```ts
    expect(privateProjects.every((project) => project.sourceUrl === undefined)).toBe(true);
    expect(privateProjects.every((project) => project.sourceLabel === undefined)).toBe(true);
```

Replace the current public-project test with:

```ts
  it("retains the five approved public project links and media", () => {
    expect(projects.filter((project) => project.sourceUrl)).toEqual([
      expect.objectContaining({
        slug: "endless-city",
        sourceUrl: "https://github.com/corashina/Endless-City",
        media: expect.objectContaining({ src: "/portfolio/endless-city.mp4" }),
      }),
      expect.objectContaining({
        slug: "webgl-minecraft",
        sourceUrl: "https://github.com/corashina/WebGL-Minecraft",
        media: expect.objectContaining({ src: "/portfolio/webgl-minecraft.png" }),
      }),
      expect.objectContaining({
        slug: "particle-simulation",
        sourceUrl: "https://github.com/corashina/Particle-Simulation",
        media: expect.objectContaining({ src: "/portfolio/particle-simulation.mp4" }),
      }),
      expect.objectContaining({
        slug: "civio",
        sourceUrl: "https://github.com/corashina/Civio",
        media: expect.objectContaining({ src: "/portfolio/civio.mp4" }),
      }),
      expect.objectContaining({
        slug: "points-in-country",
        sourceUrl: "https://github.com/corashina/points-in-country",
        media: expect.objectContaining({ src: "/portfolio/points-in-country.svg" }),
      }),
    ]);
  });
```

- [ ] **Step 2: Extend media and page integration expectations**

Add this test to `src/data/projectMedia.test.ts`:

```ts
  it("provides all four approved new media files", async () => {
    for (const src of [
      "/portfolio/shared-ui-components.svg",
      "/portfolio/erp-integration-tooling.svg",
      "/portfolio/webgl-minecraft.png",
      "/portfolio/points-in-country.svg",
    ]) {
      await expect(
        readFile(new URL("../../static" + src, import.meta.url)),
      ).resolves.toBeDefined();
    }
  });
```

In `src/pages/WorksPage.test.tsx`, replace the first test name and link count with:

```tsx
  it("renders exactly the twelve approved projects as single semantic links", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "selected projects" }),
    ).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(12);

    for (const project of projects) {
      const link = screen.getByRole("link", {
        name: `${project.title}: ${project.summary}`,
      });
      expect(link).toHaveAttribute("href", `/works/${project.slug}`);
      expect(within(link).getByRole("heading", { name: project.title })).toBeInTheDocument();
      expect(within(link).queryByRole("link")).not.toBeInTheDocument();
    }

    expect(links[0]).toHaveAttribute("href", "/works/warehouse-manufacturing-workflows");
  });
```

In `src/pages/ProjectPage.test.tsx`, rename the source-link test to `renders source links only for the five approved public projects` and use:

```ts
    const approvedSources = new Map([
      ["endless-city", "https://github.com/corashina/Endless-City"],
      ["webgl-minecraft", "https://github.com/corashina/WebGL-Minecraft"],
      ["particle-simulation", "https://github.com/corashina/Particle-Simulation"],
      ["civio", "https://github.com/corashina/Civio"],
      ["points-in-country", "https://github.com/corashina/points-in-country"],
    ]);
```

- [ ] **Step 3: Run the focused tests and confirm they fail for missing content**

Run:

```powershell
npm.cmd test -- src/data/projects.test.ts src/data/projectMedia.test.ts src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx
```

Expected: FAIL. The catalog still contains eight projects, the new slugs and source links are absent, Works renders eight links, and the four new media paths do not exist.

- [ ] **Step 4: Add the three new SVG files with the existing illustration dimensions and stroke treatment**

Create `static/portfolio/shared-ui-components.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Reusable interface component library</title><g fill="none" stroke="#777" stroke-width="2"><rect x="24" y="24" width="272" height="112" rx="3"/><rect x="42" y="42" width="74" height="24" rx="3"/><rect x="128" y="42" width="68" height="24" rx="3"/><rect x="208" y="42" width="70" height="24" rx="12"/><path d="M42 84h236M42 102h236M42 120h236M94 84v36M204 84v36"/><path d="M52 54h32M138 54h48M222 54h42"/></g></svg>
```

Create `static/portfolio/erp-integration-tooling.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>ERP integration workflow</title><g fill="none" stroke="#777" stroke-width="2"><circle cx="52" cy="80" r="22"/><circle cx="160" cy="42" r="22"/><circle cx="160" cy="118" r="22"/><rect x="238" y="55" width="58" height="50" rx="3"/><path d="M74 74l64-25M74 86l64 25M182 42h28v30h28M182 118h28V88h28M42 80h20M150 42h20M150 118h20M252 70h30M252 82h30M252 94h20"/></g></svg>
```

Create `static/portfolio/points-in-country.svg` with:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Coordinate grid inside a country boundary</title><g fill="none" stroke="#777" stroke-width="2"><path d="M66 30l55-12 44 18 39-8 48 26-9 37 19 25-54 24-49-11-43 13-52-28 9-36-17-20z"/><g fill="#777" stroke="none"><circle cx="96" cy="52" r="3"/><circle cx="128" cy="52" r="3"/><circle cx="160" cy="52" r="3"/><circle cx="192" cy="52" r="3"/><circle cx="224" cy="52" r="3"/><circle cx="96" cy="80" r="3"/><circle cx="128" cy="80" r="3"/><circle cx="160" cy="80" r="3"/><circle cx="192" cy="80" r="3"/><circle cx="224" cy="80" r="3"/><circle cx="96" cy="108" r="3"/><circle cx="128" cy="108" r="3"/><circle cx="160" cy="108" r="3"/><circle cx="192" cy="108" r="3"/><circle cx="224" cy="108" r="3"/></g></g></svg>
```

- [ ] **Step 5: Copy the authentic WebGL Minecraft preview from its public repository**

Run from the worktree root:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/Tomasz-Zielinski/WebGL-Minecraft/master/textures/preview.png" -OutFile "static/portfolio/webgl-minecraft.png"
```

Then verify the file is a non-empty PNG:

```powershell
Get-Item "static/portfolio/webgl-minecraft.png" | Select-Object Name,Length
[System.BitConverter]::ToString(
  [System.IO.File]::ReadAllBytes(
    (Resolve-Path "static/portfolio/webgl-minecraft.png").Path
  )[0..7]
)
```

Expected: length is greater than zero and the first eight bytes are `89 50 4E 47 0D 0A 1A 0A`.

- [ ] **Step 6: Insert the two new private project records**

In `src/data/projects.ts`, insert these records after Business Platforms and Approvals and before E-invoicing and KSeF:

```ts
  {
    slug: "shared-ui-components",
    title: "Shared UI Components",
    summary:
      "Reusable React controls, responsive tables, documentation, and package delivery.",
    overview:
      "A reusable React component library for consistent product interfaces. It combines Mantine controls with responsive TanStack tables, Storybook documentation, accessibility checks, Vite library builds, and npm packaging.",
    contributions: [
      "Built reusable form controls and responsive data-table components.",
      "Documented component states and usage in Storybook.",
      "Added unit, browser, and accessibility checks to the package workflow.",
    ],
    technologies: [
      "React",
      "TypeScript",
      "Mantine",
      "TanStack Table",
      "Storybook",
      "Vite",
      "Vitest",
      "Playwright",
    ],
    media: {
      kind: "image",
      src: "/portfolio/shared-ui-components.svg",
      alt: "Reusable interface components and responsive data table",
    },
  },
  {
    slug: "erp-integration-tooling",
    title: "ERP Integration Tooling",
    summary:
      "Typed n8n nodes for credentials, REST orchestration, and ERP workflows.",
    overview:
      "Integration tooling that connects automation workflows to Oracle JD Edwards through typed custom n8n nodes. It covers credential configuration, REST request orchestration, node metadata, package builds, and npm delivery.",
    contributions: [
      "Built typed n8n nodes for Oracle JD Edwards orchestration endpoints.",
      "Implemented credential handling and configurable REST request flows.",
      "Prepared build, lint, and package tooling for repeatable delivery.",
    ],
    technologies: [
      "TypeScript",
      "Node.js",
      "n8n",
      "REST APIs",
      "Oracle JD Edwards",
      "npm",
    ],
    media: {
      kind: "image",
      src: "/portfolio/erp-integration-tooling.svg",
      alt: "Automation nodes connected to an ERP service",
    },
  },
```

- [ ] **Step 7: Insert WebGL Minecraft and points-in-country**

Insert WebGL Minecraft after Endless City and before Particle Simulation:

```ts
  {
    slug: "webgl-minecraft",
    title: "WebGL Minecraft",
    summary: "A voxel world with movement, collisions, and generated terrain.",
    overview:
      "A public Three.js voxel-world experiment with pointer-lock controls, collision detection, block selection, and simple infinite terrain generation.",
    contributions: [
      "Built first-person movement and pointer-lock controls.",
      "Added terrain collisions and selectable block types.",
      "Generated simple terrain as the player moves through the world.",
    ],
    technologies: [
      "JavaScript",
      "Three.js",
      "WebGL",
      "procedural generation",
    ],
    media: {
      kind: "image",
      src: "/portfolio/webgl-minecraft.png",
      alt: "Voxel terrain in the WebGL Minecraft experiment",
    },
    sourceUrl: "https://github.com/corashina/WebGL-Minecraft",
    sourceLabel: "GitHub",
  },
```

Insert points-in-country after Civio as the final record:

```ts
  {
    slug: "points-in-country",
    title: "points-in-country",
    summary: "Coordinate grids generated inside 206 country boundaries.",
    overview:
      "A public npm package that generates arrays of coordinates inside country boundaries. It includes boundary data for 206 countries and a configurable interval for controlling grid density.",
    contributions: [
      "Built coordinate-grid generation within country boundaries.",
      "Packaged boundary data for 206 countries.",
      "Published a configurable interval for controlling point density.",
    ],
    technologies: ["JavaScript", "Node.js", "geospatial data", "npm"],
    media: {
      kind: "image",
      src: "/portfolio/points-in-country.svg",
      alt: "Coordinate grid clipped to a country boundary",
    },
    sourceUrl: "https://github.com/corashina/points-in-country",
    sourceLabel: "GitHub",
  },
```

- [ ] **Step 8: Run the focused tests and full suite**

Run:

```powershell
npm.cmd test -- src/data/projects.test.ts src/data/projectMedia.test.ts src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx
npm.cmd test
```

Expected: the four focused files pass; the full suite reports 12 passing test files and 65 passing tests.

- [ ] **Step 9: Check privacy, dates, URLs, and changed-file scope**

Run:

```powershell
rg -n -i "employer|client|company|organization name|organisation name|20[0-9]{2}" src/pages/HomePage.tsx src/data/skills.ts src/data/projects.ts static/portfolio/shared-ui-components.svg static/portfolio/erp-integration-tooling.svg
rg -n "https?://" src/data/projects.ts
git diff --check
git status --short
```

Expected: the privacy-and-date `rg` command shows no matches; the URL command shows exactly five GitHub `sourceUrl` values for Endless City, WebGL Minecraft, Particle Simulation, Civio, and points-in-country; Git lists only the Task 2 files; `git diff --check` prints nothing.

- [ ] **Step 10: Commit the project catalog and media**

```powershell
git add -- src/data/projects.ts src/data/projects.test.ts src/data/projectMedia.test.ts src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx static/portfolio/shared-ui-components.svg static/portfolio/erp-integration-tooling.svg static/portfolio/webgl-minecraft.png static/portfolio/points-in-country.svg
git commit -m "feat: add current portfolio projects"
```

---

### Task 3: Verify scope, production build, and unchanged visual behavior

**Files:**
- Verify only; no file changes expected.

**Interfaces:**
- Consumes: the completed content branch and existing Vite development server.
- Produces: test, typecheck, build, scope, and browser evidence for the finished update.

- [ ] **Step 1: Run the complete automated verification from a clean process**

Run:

```powershell
npm.cmd run verify
```

Expected: 12 test files and 65 tests pass; TypeScript exits with code 0; Vite builds `dist`; the existing chunk-size warning may remain but no build error appears.

- [ ] **Step 2: Prove no visual-system or behavior files changed**

Run:

```powershell
git diff --name-only master...HEAD
git diff --exit-code master...HEAD -- src/components src/styles src/three src/theme src/app src/pages/WorksPage.tsx src/pages/ProjectPage.tsx vite.config.ts package.json package-lock.json
git diff --check master...HEAD
git status --short
```

Expected: the name list contains the design/plan documents, the three approved production data/copy files, five approved tests, and four new media files. The scoped `git diff --exit-code` and `git diff --check` commands print nothing. The worktree is clean.

- [ ] **Step 3: Start the site and leave it running for user testing**

Run:

```powershell
Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--host","127.0.0.1","--port","4173" -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

Verify:

```powershell
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:4173/" | Select-Object StatusCode
```

Expected: HTTP status `200`. Keep the process running after verification.

- [ ] **Step 4: Review desktop behavior in the in-app browser**

Open `http://127.0.0.1:4173/` with the `browser:control-in-app-browser` skill. At the current desktop viewport:

1. Confirm the home page shows the exact two approved paragraphs and all five expanded skill groups.
2. Confirm the background Three.js animation renders and continues moving.
3. Switch Home → Work → Contact → Home and confirm the existing section transition animation remains intact.
4. Open Work and confirm twelve cards appear in the approved order with the existing widths, spacing, grayscale treatment, and hover/focus behavior.
5. Open `/works/shared-ui-components`, `/works/erp-integration-tooling`, `/works/webgl-minecraft`, and `/works/points-in-country`; confirm each page shows its overview, three contributions, technologies, and media.
6. Confirm only WebGL Minecraft and points-in-country show GitHub links among the four new projects, and each link targets its approved repository.
7. Toggle the theme and confirm the existing theme behavior and contrast remain unchanged.

Expected: content changes appear without any visual or interaction regression.

- [ ] **Step 5: Review the responsive layout**

Resize the in-app browser to a narrow mobile viewport and repeat Home, Work, and one private plus one public project detail page. Confirm no horizontal overflow, clipped copy, overlapping navigation, distorted media, or changed breakpoint behavior. Return the browser to the normal viewport and leave `http://127.0.0.1:4173/` open for the user.

- [ ] **Step 6: Report evidence and hand off the running site**

Report the exact `npm run verify` result, scope-check result, tested browser routes and viewport classes, current branch/worktree path, and the running local URL. Do not claim visual parity if any browser check failed; fix the failing content or media within the approved files and repeat Steps 1–5.
