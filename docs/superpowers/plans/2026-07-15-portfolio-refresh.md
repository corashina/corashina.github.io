# Portfolio Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Replace the obsolete Gatsby portfolio with a supported React, Vite, TypeScript, and Three.js site that preserves the existing style and presents the approved project-focused content.

**Architecture:** A static React application uses React Router for the existing URL structure, typed local data for projects and skills, and a fixed Three.js canvas behind the shared page shell. Vite builds the application for GitHub Pages, and a post-build script creates the 404 entry document needed for clean client-side routes.

**Tech Stack:** Node 24.15+, npm 11.12+, React 19.2.7, React Router 7.18.1, TypeScript 7.0.2, Vite 8.1.4, Three.js 0.185.1, Sass 1.101.0, Vitest 4.1.10, Testing Library 16.3.2

**Source Spec:** docs/superpowers/specs/2026-07-15-portfolio-refresh-design.md

## Global Constraints

- Work only in the codex/cv-refresh worktree.
- Preserve Questrial, both existing color themes, the 600px and 900px layout widths, muted borders, grayscale media, compact navigation, and pink/red accent behavior.
- Present Tomasz as a full-stack engineer with frontend and platform depth.
- Recent work must contain no employer name, client name, employment date, career timeline, private URL, private screenshot, commit count, or repository count.
- Keep exactly eight projects: five approved recent project areas plus Endless City, Particle Simulation, and Civio.
- Keep the application static. Do not add a backend, CMS, analytics, or runtime content service.
- Keep /, /works, /works/:slug, and /contact as clean BrowserRouter URLs.
- Use static/CNAME and the custom-domain base path of /.
- Respect prefers-reduced-motion for route animation, videos, and Three.js.
- Ship a CSS background when WebGL cannot initialize.
- Use local monochrome SVGs for private-project art. Do not use product screenshots or company marks.

## File Map

- package.json, package-lock.json, tsconfig.json, tsconfig.node.json, vite.config.ts, index.html: supported build and test foundation.
- src/main.tsx and src/app/App.tsx: browser bootstrap and route declarations.
- src/components/AppShell.tsx, Navigation.tsx, ThemeControl.tsx, Footer.tsx: shared shell.
- src/pages/HomePage.tsx, WorksPage.tsx, ProjectPage.tsx, ContactPage.tsx, NotFoundPage.tsx: route content.
- src/data/projects.ts and skills.ts: typed portfolio content.
- src/components/ProjectCard.tsx and ProjectMedia.tsx: project rendering and media behavior.
- src/three/shaders.ts and backgroundScene.ts: renderer-independent shader strings and Three.js controller.
- src/components/BackgroundCanvas.tsx: browser lifecycle, pointer, visibility, resize, reduced motion, and fallback.
- src/styles/*.scss: existing visual system reorganized by responsibility.
- static/portfolio/*.svg: five confidentiality-safe private-project illustrations.
- scripts/create-spa-fallback.mjs and .github/workflows/deploy-pages.yml: clean-route fallback and Pages deployment.

---

### Task 1: Supported Vite foundation

**Files:**
- Modify: package.json
- Replace: package-lock.json
- Create: index.html, tsconfig.json, tsconfig.node.json, vite.config.ts
- Create: src/test/setup.ts, src/main.tsx, src/app/App.tsx, src/app/App.test.tsx
- Create: src/components/AppShell.tsx
- Create: src/pages/HomePage.tsx, WorksPage.tsx, ProjectPage.tsx, ContactPage.tsx, NotFoundPage.tsx
- Create: src/styles/global.scss

**Interfaces:**
- Produces App(): JSX.Element inside BrowserRouter.
- Produces AppShell(): JSX.Element with an Outlet.
- Produces routes /, /works, /works/:slug, /contact, and *.

- [ ] **Step 1: Replace package.json and install supported dependencies**

~~~json
{
  "name": "tomasz-zielinski-portfolio",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=24.15.0", "npm": ">=11.12.0" },
  "scripts": {
    "dev": "vite",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "npm run typecheck && vite build",
    "verify": "npm run test && npm run build"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-icons": "^5.7.0",
    "react-router-dom": "^7.18.1",
    "three": "^0.185.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/user-event": "^14.6.1",
    "@types/node": "^26.1.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "jsdom": "^29.1.1",
    "sass": "^1.101.0",
    "typescript": "^7.0.2",
    "vite": "^8.1.4",
    "vitest": "^4.1.10"
  }
}
~~~

Run npm.cmd install. Expected: npm exits 0 without node-sass or Sharp build errors.

- [ ] **Step 2: Add exact compiler, Vite, HTML, and test setup**

tsconfig.json must use strict true, noEmit true, module ESNext, moduleResolution Bundler, jsx react-jsx, libs ES2022/DOM/DOM.Iterable, and include src. tsconfig.node.json must be composite, noEmit, allowJs true, checkJs true, moduleResolution Bundler, types node, and include vite.config.ts plus scripts/**/*.

vite.config.ts:

~~~ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/",
  publicDir: "static",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true
  }
});
~~~

index.html must contain root, /src/main.tsx, UTF-8 and viewport metadata, /favicon.ico, title Tomasz Zielinski, and description Tomasz Zielinski, full-stack software engineer.

src/test/setup.ts:

~~~ts
import "@testing-library/jest-dom/vitest";
~~~

- [ ] **Step 3: Write the failing route test**

~~~tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App routes", () => {
  it.each([
    ["/", "Tomasz Zielinski"],
    ["/works", "Work"],
    ["/contact", "Contact"],
    ["/missing", "404"]
  ])("renders %s", (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });
});
~~~

Run npm.cmd test -- src/app/App.test.tsx. Expected: FAIL because App does not exist.

- [ ] **Step 4: Implement the minimal route tree**

src/main.tsx must validate #root, call createRoot, wrap App in StrictMode and BrowserRouter, and import styles/global.scss. Create src/styles/global.scss as an empty foundation file; Task 3 replaces it with the preserved global styles. App.tsx must declare the routes listed in Interfaces under one AppShell route. AppShell renders Outlet. The five page components render these exact headings: Tomasz Zielinski, Work, Project, Contact, and 404. NotFoundPage also renders not found and Sorry. This page does not exist.

Run npm.cmd test -- src/app/App.test.tsx and npm.cmd run build. Expected: 4 route cases pass and dist/index.html exists.

- [ ] **Step 5: Commit**

~~~powershell
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/test src/app src/components/AppShell.tsx src/pages
git commit -m "build: migrate portfolio foundation to Vite"
~~~

### Task 2: Typed project content and privacy tests

**Files:**
- Create: src/data/projects.ts
- Create: src/data/projects.test.ts

**Interfaces:**

~~~ts
export type ProjectMedia = {
  kind: "image" | "video";
  src: string;
  alt: string;
};

export type Project = {
  slug: string;
  title: string;
  summary: string;
  overview: string;
  contributions: readonly string[];
  technologies: readonly string[];
  media: ProjectMedia;
  sourceUrl?: string;
  sourceLabel?: string;
};

export const projects: readonly Project[];
export const getProjectBySlug: (slug: string) => Project | undefined;
~~~

- [ ] **Step 1: Write failing contract tests**

~~~ts
import { describe, expect, it } from "vitest";
import { getProjectBySlug, projects } from "./projects";

describe("projects", () => {
  it("contains eight unique projects", () => {
    expect(projects).toHaveLength(8);
    expect(new Set(projects.map((project) => project.slug)).size).toBe(8);
  });

  it("retains exactly three linked WebGL projects", () => {
    expect(projects.filter((project) => project.sourceUrl).map((project) => project.title))
      .toEqual(["Endless City", "Particle Simulation", "Civio"]);
  });

  it("keeps recent work free of organization attribution and timelines", () => {
    const text = projects.filter((project) => !project.sourceUrl)
      .map((project) => JSON.stringify(project).toLowerCase()).join(" ");
    expect(text).not.toMatch(
      /\b(?:employer|client|company|organi[sz]ation)\s*(?:name\s*)?[:=-]\s*[\w"']/i,
    );
    expect(text).not.toMatch(/\b(?:19|20)\d{2}\b/);
  });

  it("looks up by slug", () => {
    expect(getProjectBySlug("document-ai")?.title).toBe("Document AI");
    expect(getProjectBySlug("missing")).toBeUndefined();
  });
});
~~~

Run npm.cmd test -- src/data/projects.test.ts. Expected: FAIL because projects.ts does not exist.

- [ ] **Step 2: Implement all eight records**

Use the interface above and this exact content map. Each recent record receives three contribution bullets derived from its overview, without adding names or dates.

| slug | title | summary focus | technologies | media |
| --- | --- | --- | --- | --- |
| warehouse-manufacturing-workflows | Warehouse and Manufacturing Workflows | scanner-led transfers, production, inventory, reservations, labels | React, TypeScript, REST APIs, ERP integration, barcode scanners | /portfolio/warehouse-manufacturing.svg |
| business-platforms-approvals | Business Platforms and Approvals | identity, configuration, approvals, scheduling, vendor processes | React, TypeScript, Redux Toolkit, TanStack Query, Mantine | /portfolio/business-platforms.svg |
| e-invoicing-ksef | E-invoicing and KSeF | invoice rules, documents, logs, PDF/XML, KSeF | React, TypeScript, .NET, C#, XML, XSLT, KSeF | /portfolio/e-invoicing-ksef.svg |
| document-ai | Document AI | PDF intake, prompts, analysis, JSON/text results | React, TypeScript, PDF, JSON, AI integration | /portfolio/document-ai.svg |
| mobile-applications | Mobile Applications | authentication, scanning, files, network-aware mobile use | React Native, Expo, Flutter, TypeScript, REST APIs | /portfolio/mobile-applications.svg |
| endless-city | Endless City | infinite procedural WebGL city | JavaScript, Three.js, WebGL, glTF | /portfolio/endless-city.mp4 |
| particle-simulation | Particle Simulation | GLSL GPU particle motion | TypeScript, Three.js, WebGL, GLSL | /portfolio/particle-simulation.mp4 |
| civio | Civio | procedural hexagonal map | JavaScript, Three.js, WebGL, Procedural generation | /portfolio/civio.mp4 |

Set sourceUrl and sourceLabel github only on the last three, using the existing corashina repository URLs. Use as const satisfies readonly Project[] and implement lookup with Array.find.

Run npm.cmd test -- src/data/projects.test.ts and npm.cmd run typecheck. Expected: 4 tests pass and no type errors.

- [ ] **Step 3: Commit**

~~~powershell
git add src/data/projects.ts src/data/projects.test.ts
git commit -m "feat: add current portfolio project data"
~~~

### Task 3: Preserved shell, themes, navigation, and contact

**Files:**
- Create: src/theme/theme.ts, src/theme/theme.test.ts
- Create: src/components/Navigation.tsx, ThemeControl.tsx, Footer.tsx
- Modify: src/components/AppShell.tsx, src/pages/ContactPage.tsx, src/main.tsx
- Create: src/styles/themes.scss, global.scss, layout.module.scss, contact.module.scss

**Interfaces:**
- Theme is dark or white.
- readInitialTheme(storage, prefersLight) returns Theme.
- applyTheme(theme, root) applies one class and colorScheme.
- AppShell owns theme state and later passes it to BackgroundCanvas.

- [ ] **Step 1: Write failing theme tests**

~~~ts
import { describe, expect, it } from "vitest";
import { applyTheme, readInitialTheme } from "./theme";

describe("theme", () => {
  it("prefers stored valid values", () => {
    expect(readInitialTheme({ getItem: () => "white" }, false)).toBe("white");
  });
  it("uses system preference without storage", () => {
    expect(readInitialTheme({ getItem: () => null }, true)).toBe("white");
    expect(readInitialTheme({ getItem: () => null }, false)).toBe("dark");
  });
  it("applies one class", () => {
    const root = document.createElement("body");
    root.className = "dark";
    applyTheme("white", root);
    expect(root).toHaveClass("white");
    expect(root).not.toHaveClass("dark");
    expect(root.style.colorScheme).toBe("light");
  });
});
~~~

Run npm.cmd test -- src/theme/theme.test.ts. Expected: FAIL because theme.ts does not exist.

- [ ] **Step 2: Implement theme helpers**

~~~ts
export type Theme = "dark" | "white";

export function readInitialTheme(
  storage: Pick<Storage, "getItem">,
  prefersLight: boolean
): Theme {
  const stored = storage.getItem("portfolio-theme");
  return stored === "dark" || stored === "white"
    ? stored
    : prefersLight ? "white" : "dark";
}

export function applyTheme(theme: Theme, root: HTMLElement) {
  root.classList.remove("dark", "white");
  root.classList.add(theme);
  root.style.colorScheme = theme === "white" ? "light" : "dark";
}
~~~

- [ ] **Step 3: Implement the shell**

Navigation uses NavLink for Home, Work, Contact; a semantic button with GoThreeBars/GoX; aria-expanded; aria-controls; and closes after navigation. ThemeControl is a button labeled Switch to light theme or Switch to dark theme. Footer retains the current copyright line.

AppShell initializes theme from localStorage and matchMedia, applies and stores changes in an effect, renders Navigation, a pathname-keyed main/Outlet, and Footer. ContactPage retains email, resume PDF, GitHub, Stack Overflow, LinkedIn, and Twitter with react-icons/fa and semantic list markup.

- [ ] **Step 4: Restore exact visual tokens and layout behavior**

themes.scss values:

~~~scss
$spacing: 1.5rem;
$media-sm: 480px;
$media-md: 768px;

body.white {
  --color-bg: #fff;
  --color-1: #000;
  --color-2: #aaa;
  --color-25: #ccc;
  --color-3: #880000;
}

body.dark {
  --color-bg: #222;
  --color-1: #ccc;
  --color-2: #666;
  --color-25: #444;
  --color-3: #f44263;
}
~~~

global.scss imports Questrial, uses 14px/1.5, background and foreground variables, normal-weight headings at 2.25rem/1.5rem/1.25rem, justified paragraphs, accent hover links, and 2px accent focus-visible outlines. layout.module.scss uses max content widths 600px plus 48px padding and 900px plus padding for work, the existing 5rem nav/footer rhythm, thin borders, mobile links below 480px, and a 500ms horizontal route entrance disabled by reduced motion. contact.module.scss preserves the icon list.

Run npm.cmd test -- src/theme/theme.test.ts src/app/App.test.tsx and npm.cmd run build. Expected: tests and build pass.

- [ ] **Step 5: Commit**

~~~powershell
git add src/theme src/components src/pages/ContactPage.tsx src/styles src/main.tsx
git commit -m "feat: restore theme-aware portfolio shell"
~~~

### Task 4: Approved homepage and grouped skills

**Files:**
- Create: src/data/skills.ts, src/components/Skills.tsx
- Modify: src/pages/HomePage.tsx
- Create: src/pages/HomePage.test.tsx, src/styles/home.module.scss

**Interfaces:** SkillGroup has name and readonly skills. Skills renders a section labeled Skills.

- [ ] **Step 1: Write the failing homepage test**

~~~tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";

it("renders approved positioning and groups", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { name: "a full-stack software engineer" })).toBeInTheDocument();
  expect(screen.getByText(/operational workflows/)).toBeInTheDocument();
  const region = screen.getByLabelText("Skills");
  for (const name of ["Frontend", "Backend & Integration", "Mobile", "Data & Documents", "Delivery"]) {
    expect(within(region).getByRole("heading", { name })).toBeInTheDocument();
  }
});
~~~

Run npm.cmd test -- src/pages/HomePage.test.tsx. Expected: FAIL.

- [ ] **Step 2: Add exact skill data**

- Frontend: TypeScript, JavaScript, React, Redux Toolkit, TanStack Query, Three.js, WebGL, Material UI, Mantine, Sass, Tailwind CSS, Vite.
- Backend & Integration: .NET, C#, Node.js, REST APIs, JWT, n8n, Oracle JD Edwards.
- Mobile: React Native, Expo, Flutter.
- Data & Documents: KSeF, XML, XSLT, PDF workflows, JSON, Document AI.
- Delivery: GitHub Actions, CI/CD, npm publishing, Vitest, Testing Library.

Skills renders each group as h3 plus a tag list, without ratings.

- [ ] **Step 3: Add the approved copy**

HomePage renders h1 Tomasz Zielinski, h2 a full-stack software engineer, and these paragraphs:

~~~text
I build web and mobile software for operational workflows, business platforms, integrations, and document-heavy systems. My work covers React and TypeScript interfaces, API and ERP integrations, mobile applications, e-invoicing, and document AI.

I work across product UI, backend services, and delivery tooling to turn complex processes into software people can use under real working conditions.
~~~

home.module.scss uses the current 2fr/1fr layout above 480px, left-aligns copy, right-aligns skill groups, and renders tags with thin muted borders. Mobile stacks and left-aligns both columns.

Run npm.cmd test -- src/pages/HomePage.test.tsx and npm.cmd test. Expected: all pass.

- [ ] **Step 4: Commit**

~~~powershell
git add src/data/skills.ts src/components/Skills.tsx src/pages/HomePage.tsx src/pages/HomePage.test.tsx src/styles/home.module.scss
git commit -m "feat: update introduction and skillset"
~~~

### Task 5: Work grid, project routes, and media behavior

**Files:**
- Create: src/components/ProjectCard.tsx, ProjectMedia.tsx
- Modify: src/pages/WorksPage.tsx, ProjectPage.tsx
- Create: src/pages/WorksPage.test.tsx, ProjectPage.test.tsx
- Create: src/styles/work.module.scss

**Interfaces:** ProjectCard consumes Project. ProjectMedia consumes ProjectMedia plus interactive boolean.

- [ ] **Step 1: Write failing page tests**

WorksPage test asserts eight links and /works/warehouse-manufacturing-workflows. ProjectPage tests document-ai has no github link, endless-city links to its GitHub repository, and missing slug renders h1 404. Render ProjectPage under MemoryRouter and Route path /works/:slug.

Run npm.cmd test -- src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx. Expected: FAIL.

- [ ] **Step 2: Implement ProjectMedia and ProjectCard**

ProjectMedia renders an img for image media and a muted, looped, playsInline, metadata-preloaded video for video media. It calls video.play on hover/focus only when reduced motion is false, catches the play promise, pauses and resets on leave/blur, and replaces failed media with a text fallback containing alt. ProjectCard is one Link to /works/ plus slug, with media, visible title, and an aria-label containing title and summary.

- [ ] **Step 3: Implement list and detail pages**

WorksPage renders h1 Work, h2 selected projects, and all eight cards. ProjectPage resolves useParams slug with getProjectBySlug, renders NotFoundPage on undefined, and otherwise renders media, title, overview, selected contribution list, technology tags, and optional source link.

work.module.scss preserves the one/two/three-column breakpoints, 1.5rem gaps, 5px card inset, thin borders, grayscale media, accent hover/focus, 2:1 media ratio, and 2fr/1fr detail layout.

Run npm.cmd test -- src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx and npm.cmd test. Expected: all pass.

- [ ] **Step 4: Commit**

~~~powershell
git add src/components/ProjectCard.tsx src/components/ProjectMedia.tsx src/pages/WorksPage.tsx src/pages/ProjectPage.tsx src/pages/WorksPage.test.tsx src/pages/ProjectPage.test.tsx src/styles/work.module.scss src/styles/layout.module.scss
git commit -m "feat: add project grid and detail routes"
~~~

### Task 6: Confidentiality-safe SVG artwork

**Files:**
- Create: static/portfolio/warehouse-manufacturing.svg
- Create: static/portfolio/business-platforms.svg
- Create: static/portfolio/e-invoicing-ksef.svg
- Create: static/portfolio/document-ai.svg
- Create: static/portfolio/mobile-applications.svg
- Create: src/data/projectMedia.test.ts

- [ ] **Step 1: Write the failing asset test**

~~~ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { projects } from "./projects";

describe("private artwork", () => {
  it("provides titled 320 by 160 SVGs", async () => {
    for (const project of projects.filter((item) => !item.sourceUrl)) {
      const file = await readFile(new URL("../../static" + project.media.src, import.meta.url), "utf8");
      expect(file).toContain("<title>");
      expect(file).toContain('viewBox="0 0 320 160"');
      expect(file).not.toMatch(
        /(?:data-(?:employer|client|company|organi[sz]ation)|<(?:text|title|desc)[^>]*>[^<]*(?:employer|client|company|organi[sz]ation)\s*(?:name\s*)?[:=-])/i,
      );
    }
  });
});
~~~

Run npm.cmd test -- src/data/projectMedia.test.ts. Expected: FAIL with ENOENT.

- [ ] **Step 2: Create exact visual motifs**

Each file uses xmlns, viewBox 0 0 320 160, fill none, stroke #777, stroke-width 2, and one title:

- warehouse-manufacturing.svg: title Warehouse workflow; two storage racks, connecting path, scanner rectangle, five barcode strokes.
- business-platforms.svg: title Business platform modules; four corner modules connected to one central approval rectangle with a check mark.
- e-invoicing-ksef.svg: title E-invoicing document flow; folded-corner document, arrow, validation panel, check mark.
- document-ai.svg: title Document analysis fields; document with three field rectangles connected to a three-node analysis circle.
- mobile-applications.svg: title Connected mobile applications; two rounded phone frames connected by opposing workflow arrows.

No text, logos, screenshots, gradients, or brand colors may appear inside the artwork.

Use these complete file bodies:

~~~svg
<!-- warehouse-manufacturing.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Warehouse workflow</title><g fill="none" stroke="#777" stroke-width="2"><path d="M18 128h284M34 128V38h84v90M202 128V22h84v106M50 54h52M50 76h52M50 98h52M218 42h52M218 66h52M218 90h52M118 84h84M158 84v32"/><rect x="139" y="116" width="38" height="18"/><path d="M146 120v10m6-10v10m6-10v10m6-10v10m6-10v10"/></g></svg>

<!-- business-platforms.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Business platform modules</title><g fill="none" stroke="#777" stroke-width="2"><rect x="119" y="56" width="82" height="48" rx="3"/><rect x="20" y="20" width="72" height="34" rx="3"/><rect x="228" y="20" width="72" height="34" rx="3"/><rect x="20" y="106" width="72" height="34" rx="3"/><rect x="228" y="106" width="72" height="34" rx="3"/><path d="M92 37l27 30M228 37l-27 30M92 123l27-30M228 123l-27-30M154 80l4 4 8-10"/></g></svg>

<!-- e-invoicing-ksef.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>E-invoicing document flow</title><g fill="none" stroke="#777" stroke-width="2"><path d="M28 26h86l20 20v88H28zM114 26v20h20M46 66h70M46 84h70M46 102h42M148 80h48M184 70l12 10-12 10"/><rect x="208" y="38" width="84" height="84" rx="4"/><path d="M224 58h52M224 76h52M224 94h32M267 105l4 4 8-10"/></g></svg>

<!-- document-ai.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Document analysis fields</title><g fill="none" stroke="#777" stroke-width="2"><path d="M28 18h116l20 20v104H28zM144 18v20h20"/><rect x="46" y="56" width="82" height="14"/><rect x="46" y="82" width="50" height="14"/><rect x="46" y="108" width="88" height="14"/><circle cx="232" cy="80" r="38"/><circle cx="232" cy="80" r="17"/><path d="M164 63l31 9M164 91l31-5M164 118l39-20M249 64l29-26M260 80h42M249 97l28 26"/></g></svg>

<!-- mobile-applications.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160"><title>Connected mobile applications</title><g fill="none" stroke="#777" stroke-width="2"><rect x="34" y="14" width="78" height="132" rx="10"/><rect x="208" y="14" width="78" height="132" rx="10"/><path d="M61 30h24M235 30h24M61 132h24M235 132h24"/><rect x="50" y="48" width="46" height="52"/><path d="M58 58h30M58 70h30M58 82h20M224 54h46M224 70h46M224 86h46M224 102h32M112 80h96M150 68l12 12-12 12M170 68l-12 12 12 12"/></g></svg>
~~~

Run npm.cmd test -- src/data/projectMedia.test.ts and npm.cmd run build. Expected: test passes and five SVGs exist in dist/portfolio.

- [ ] **Step 3: Commit**

~~~powershell
git add static/portfolio/*.svg src/data/projectMedia.test.ts
git commit -m "feat: add private-safe project artwork"
~~~

### Task 7: Layered Three.js contour background

**Files:**
- Create: src/three/shaders.ts, backgroundScene.ts, backgroundScene.test.ts
- Create: src/components/BackgroundCanvas.tsx, BackgroundCanvas.test.tsx
- Create: src/styles/canvas.module.scss
- Modify: src/components/AppShell.tsx

**Interfaces:**

~~~ts
export type SceneTheme = { wire: THREE.ColorRepresentation; background: THREE.ColorRepresentation };
export type BackgroundController = {
  start(): void;
  stop(): void;
  resize(width: number, height: number, pixelRatio: number): void;
  setPointer(x: number, y: number): void;
  setTheme(theme: SceneTheme): void;
  renderStatic(): void;
  dispose(): void;
};
export const capPixelRatio: (value: number) => number;
export const normalizePointer: (clientX: number, clientY: number, rect: DOMRect) => { x: number; y: number };
~~~

- [ ] **Step 1: Write failing helper tests**

~~~ts
import { describe, expect, it } from "vitest";
import { capPixelRatio, normalizePointer } from "./backgroundScene";

it("caps device pixel ratio", () => {
  expect(capPixelRatio(1)).toBe(1);
  expect(capPixelRatio(2)).toBe(1.5);
  expect(capPixelRatio(0)).toBe(1);
});

it("normalizes pointer around center", () => {
  const rect = { left: 10, top: 20, width: 200, height: 100 } as DOMRect;
  expect(normalizePointer(110, 70, rect)).toEqual({ x: 0, y: 0 });
  expect(normalizePointer(210, 20, rect)).toEqual({ x: 1, y: 1 });
});
~~~

Run npm.cmd test -- src/three/backgroundScene.test.ts. Expected: FAIL.

- [ ] **Step 2: Implement shader strings**

shaders.ts exports vertexShader and fragmentShader. The vertex shader implements hash, interpolated 2D noise, four-octave fbm, time drift, pointer-local exponential influence, and normal displacement. The fragment shader takes uColor and uOpacity and fades wire intensity from displaced height. Store source as arrays joined by newline so TypeScript requires no raw-loader plugin.

~~~ts
export const vertexShader = [
  "uniform float uTime;",
  "uniform float uAmplitude;",
  "uniform vec2 uPointer;",
  "varying float vHeight;",
  "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
  "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}",
  "float fbm(vec2 p){float v=0.0;float w=0.5;for(int i=0;i<4;i++){v+=w*noise(p);p=p*2.03+vec2(7.1,3.7);w*=0.5;}return v;}",
  "void main(){vec2 q=position.xy*0.0022+vec2(uTime*0.018,-uTime*0.012);float terrain=fbm(q)*2.0-1.0;vec2 focus=uPointer*vec2(850,520);float influence=exp(-distance(position.xy,focus)*0.0025);float h=terrain*uAmplitude+influence*42.0;vHeight=h;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*h,1.0);}"
].join("\n");

export const fragmentShader = [
  "uniform vec3 uColor;",
  "uniform float uOpacity;",
  "varying float vHeight;",
  "void main(){float fade=smoothstep(-220.0,260.0,vHeight);gl_FragColor=vec4(uColor,uOpacity*mix(0.55,1.0,fade));}"
].join("\n");
~~~

- [ ] **Step 3: Implement createBackgroundScene**

Use WebGLRenderer with antialias, PerspectiveCamera at 0/-180/1050, PlaneGeometry 3600x2400 with 120x80 segments, and two wireframe ShaderMaterial layers at z 0 and -135. Use amplitudes 210 and 150 and opacity 0.68 and 0.22.

The controller must:

- Cap renderer pixel ratio at 1.5.
- Resize without changing CSS size.
- Lerp pointer input, camera offset, wire color, and clear color.
- Advance shader time for animation and use a fixed time of 18 for reduced motion.
- Stop requestAnimationFrame while hidden.
- Dispose geometry, both materials, renderer, and animation frame.

- [ ] **Step 4: Write and pass the component lifecycle test**

Mock createBackgroundScene with start/stop/resize/setPointer/setTheme/renderStatic/dispose spies. Stub global ResizeObserver with observe and disconnect spies in the test before rendering. Render BackgroundCanvas theme dark, assert an aria-hidden canvas, assert start, unmount, and assert dispose.

BackgroundCanvas creates the controller in an effect, catches WebGL creation failure and hides the canvas, uses ResizeObserver, normalizes passive pointer events, listens for visibilitychange, renders one frame for reduced motion, updates theme in a second effect, and removes every observer/listener on cleanup.

Use colors dark wire #555/background #222 and white wire #b7b7b7/background #fff. canvas.module.scss fixes the canvas to inset 0, z-index -1, full size, with CSS variable background.

Add BackgroundCanvas before Navigation in AppShell and pass theme.

Run npm.cmd test -- src/three/backgroundScene.test.ts src/components/BackgroundCanvas.test.tsx, npm.cmd test, and npm.cmd run build. Expected: all pass.

- [ ] **Step 5: Commit**

~~~powershell
git add src/three src/components/BackgroundCanvas.tsx src/components/BackgroundCanvas.test.tsx src/components/AppShell.tsx src/styles/canvas.module.scss
git commit -m "feat: add layered Three.js contour background"
~~~

### Task 8: GitHub Pages, legacy cleanup, and final verification

**Files:**
- Create: scripts/create-spa-fallback.mjs, scripts/create-spa-fallback.test.ts
- Create: .github/workflows/deploy-pages.yml
- Modify: package.json, tsconfig.node.json
- Remove: Gatsby config, Gatsby JSX source, old generated public output, unused old media

- [ ] **Step 1: Write failing fallback test**

~~~ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createSpaFallback } from "./create-spa-fallback.mjs";

it("copies index to 404", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-"));
  await writeFile(join(directory, "index.html"), "<main>portfolio</main>");
  await createSpaFallback(directory);
  expect(await readFile(join(directory, "404.html"), "utf8")).toBe("<main>portfolio</main>");
});
~~~

Run npm.cmd test -- scripts/create-spa-fallback.test.ts. Expected: FAIL.

- [ ] **Step 2: Implement fallback and build hook**

~~~js
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} outputDirectory */
export async function createSpaFallback(outputDirectory) {
  await copyFile(join(outputDirectory, "index.html"), join(outputDirectory, "404.html"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await createSpaFallback(fileURLToPath(new URL("../dist", import.meta.url)));
}
~~~

Change build to npm run typecheck && vite build && node scripts/create-spa-fallback.mjs. Include scripts/**/* in tsconfig.node.json with allowJs and checkJs enabled.

- [ ] **Step 3: Add GitHub Pages workflow**

~~~yaml
name: Deploy portfolio
on:
  push:
    branches: [master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run verify
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy
        uses: actions/deploy-pages@v4
~~~

- [ ] **Step 4: Remove legacy files**

Use git rm for gatsby-browser.js, gatsby-config.js, gatsby-node.js, tracked public, src/layouts, src/templates, old JSX components/pages, src/components/utils, src/components/styles, and src/data/works.json. Remove unused old media: agario.mp4, digital-doily.png, fitmed.png, flappy-pixie.mp4, kiteprint.png, sushi-go.png, webgl-minecraft.mp4. Retain favicon, CNAME, robots.txt, resume PDF, the five SVGs, and three selected MP4s.

- [ ] **Step 5: Run automated final verification**

~~~powershell
npm.cmd test -- scripts/create-spa-fallback.test.ts
npm.cmd run verify
Test-Path dist/index.html
Test-Path dist/404.html
Test-Path dist/CNAME
git diff --check
~~~

Expected: all tests, type checking, and build pass; each Test-Path is True; no whitespace errors.

- [ ] **Step 6: Run browser acceptance checks**

Start npm.cmd run dev -- --host 127.0.0.1 --port 4173 and use the in-app browser.

- Check both themes, Questrial, original widths, borders, accent, and route transition.
- Check one/two/three project columns at phone/tablet/desktop widths.
- Open all eight project routes through direct URL entry.
- Confirm recent pages show no employer, client, timeline, or private claim.
- Confirm three WebGL projects retain video and GitHub links.
- Navigate every control by keyboard and confirm visible accent focus.
- Emulate reduced motion and confirm route, video, and canvas motion stop.
- Confirm pointer response stays subtle and text remains readable.
- Force WebGL initialization failure and confirm CSS fallback plus usable content.

- [ ] **Step 7: Commit cleanup and deployment**

~~~powershell
git add package.json package-lock.json tsconfig.node.json scripts .github src static
git commit -m "chore: finish portfolio migration and deployment"
npm.cmd run verify
git status --short
~~~

Expected: verification passes and git status is clean.
