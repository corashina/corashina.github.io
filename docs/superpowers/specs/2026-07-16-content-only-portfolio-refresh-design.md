# Content-only portfolio refresh design

## Goal

Refresh the portfolio so it represents the current breadth of Tomasz's work while preserving the site's visual presentation and behavior exactly. The update changes copy, skills, project data, and project media only. It is a portfolio of selected projects and work, not a chronological CV.

## Non-goals and hard constraints

- Do not change components, JSX structure, stylesheets, CSS classes, layout, spacing, widths, typography, colors, breakpoints, routing, navigation, animations, shaders, theme behavior, or interactions.
- Do not add company names, customer names, job titles, employment history, dates, or timelines.
- Do not publish internal repository names, internal URLs, credentials, private prompts, customer data, or implementation details that expose private systems.
- Do not redesign cards, media treatment, hover behavior, grayscale treatment, grids, or project-detail layouts.
- Do not remove or replace existing project media.

## Source and privacy policy

Private work is described only in generalized, outcome-focused language derived from the local work summary. Public project claims and repository links come from the public `corashina` GitHub profile and project READMEs. Copy must remain factual, concise, and free of confidential identifiers.

## Editable production scope

Only these production files may be changed:

- `src/pages/HomePage.tsx`
- `src/data/skills.ts`
- `src/data/projects.ts`
- four new media assets under `static/portfolio/`

Tests may be updated or added to lock the approved copy, skill groups, project order, slugs, media, and source links. No visual-system file may change.

## Home copy

Keep the existing heading:

> a full-stack software engineer

Replace the two introductory paragraphs with:

> I build web and mobile applications for operations, approvals, document processing, and ERP-connected workflows. My work spans React and TypeScript interfaces, reusable component systems, native mobile clients, .NET services, and automation tooling.

> I focus on software that turns complex business rules into clear, reliable tools—from scanner-led warehouse processes and editable document workflows to e-invoicing, integrations, and WebGL experiments.

## Skills

Keep the existing five-group data structure and the existing `Skills` component. Use the following content and order:

### Frontend

TypeScript, JavaScript, React, Redux Toolkit, TanStack Query, TanStack Table, Three.js, WebGL, Mantine, Material UI, Sass, Tailwind CSS, Vite, Storybook

### Backend & Integration

.NET, C#, Node.js, REST APIs, JWT, n8n, Oracle JD Edwards

### Mobile

React Native, Expo, Flutter, React Navigation, EAS Build

### Data & Documents

KSeF, XML, XSLT, PDF workflows, JSON, Document AI, dynamic forms

### Delivery

GitHub Actions, CI/CD, npm publishing, Vitest, Testing Library, Playwright, accessibility testing

## Project collection and order

Keep all eight current projects and insert four new ones, for twelve projects total in this exact order:

1. Warehouse and Manufacturing Workflows
2. Business Platforms and Approvals
3. Shared UI Components
4. ERP Integration Tooling
5. E-invoicing and KSeF
6. Document AI
7. Mobile Applications
8. Endless City
9. WebGL Minecraft
10. Particle Simulation
11. Civio
12. points-in-country

Existing project records retain their current text, slugs, links, and media unless a small factual correction is required during implementation. The four new records must follow the existing `Project` type and card/detail-page behavior.

## New project content

### Shared UI Components

- Slug: `shared-ui-components`
- Position: after Business Platforms and Approvals
- Focus: a reusable React component system built around Mantine controls, responsive TanStack tables, Storybook documentation, accessibility checks, Vite library builds, and npm packaging.
- Technologies: React, TypeScript, Mantine, TanStack Table, Storybook, Vite, Vitest, Playwright
- Source link: none; this is generalized private work.
- Media: a new privacy-safe illustration consistent with the visual language and dimensions of the existing private-project illustrations.

### ERP Integration Tooling

- Slug: `erp-integration-tooling`
- Position: after Shared UI Components
- Focus: typed custom n8n nodes for credential handling, REST orchestration, and Oracle JD Edwards integration, including package build and delivery tooling.
- Technologies: TypeScript, Node.js, n8n, REST APIs, Oracle JD Edwards, npm
- Source link: none; this is generalized private work.
- Media: a new privacy-safe illustration consistent with the visual language and dimensions of the existing private-project illustrations.

### WebGL Minecraft

- Slug: `webgl-minecraft`
- Position: after Endless City
- Focus: a public Three.js voxel-world experiment with movement, collision detection, block selection, pointer lock, and simple infinite terrain generation.
- Technologies: JavaScript, Three.js, WebGL, procedural generation
- Source link: `https://github.com/corashina/WebGL-Minecraft`, labelled `GitHub`
- Media: an authentic preview sourced from the public repository and stored locally under `static/portfolio/` so it uses the existing media path and fallback behavior.

### points-in-country

- Slug: `points-in-country`
- Position: last
- Focus: a public npm package that generates coordinate grids inside the boundaries of 206 countries with a configurable interval.
- Technologies: JavaScript, Node.js, geospatial data, npm
- Source link: `https://github.com/corashina/points-in-country`, labelled `GitHub`
- Media: a restrained coordinate-map illustration stored locally under `static/portfolio/` and displayed through the existing image treatment.

## Media rules

Add exactly four media files, one for each new project. New illustrations and repository preview media must fit the current card and detail views without layout changes. Use descriptive alt text. Preserve the existing image/video error fallback and do not introduce remote runtime dependencies.

## Test and verification strategy

- Add or update tests before production data changes to cover the approved home copy, five skill groups, twelve-project count and order, new slugs, media paths, technology labels, and public GitHub links.
- Run `npm run test`, `npm run typecheck`, and `npm run build` (or the existing combined `npm run verify`).
- Run `git diff --check`.
- Check the changed-file list and fail the review if any production file outside the three approved data/copy files and four new media assets changed.
- Review the running site in the browser at desktop and mobile widths. Confirm navigation, section transitions, background animation, theme behavior, cards, project detail pages, source links, media loading, and fallbacks behave exactly as before.
- Compare screenshots of unchanged views where helpful; content will differ, but the visual system must not.

## Acceptance criteria

The site presents the approved current summary, expanded skills, and twelve-project collection; all private work remains generalized; no company or timeline content appears; all four new projects have working detail pages and media; public links are correct; automated verification passes; and no visual or behavioral implementation file is changed.
