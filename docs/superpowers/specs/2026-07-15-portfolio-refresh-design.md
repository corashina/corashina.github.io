# Portfolio Refresh Design

Date: 2026-07-15

## Goal

Update Tomasz Zielinski's portfolio to reflect his current full-stack work while preserving the site's established visual character. Replace the obsolete Gatsby 2 build with a supported React, Vite, TypeScript, and Three.js stack. Keep the portfolio project-focused rather than presenting it as a chronological CV.

## Design Principles

- Preserve the existing typography, spacing, narrow layout, navigation, theme colors, grayscale media, border treatment, and accent color.
- Present Tomasz as a full-stack engineer with frontend and platform depth.
- Describe recent work through projects and technical contributions. Do not name the employer, clients, employment dates, career progression, private repositories, or commit metrics.
- Keep three public WebGL projects to retain the portfolio's creative coding identity and provide source links.
- Keep the site static and suitable for GitHub Pages.
- Respect reduced-motion preferences and provide fallbacks for media and WebGL failures.

## Technical Architecture

### Application stack

The implementation will replace Gatsby 2 with:

- Vite
- React
- TypeScript
- React Router
- Current Three.js
- Sass modules and global Sass styles
- Vitest and Testing Library

The migration will remove Gatsby's GraphQL data layer, page generation, layout plugin, Sharp integration, and obsolete Node Sass dependency. Vite will compile the site into a static `dist` directory.

### Routes

The site will preserve its current route structure:

- `/` for the introduction and skills
- `/works` for the project grid
- `/works/:slug` for project details
- `/contact` for contact information
- A catch-all route for the not-found page

GitHub Pages must resolve direct visits to client-side routes. The build will copy the application entry document to `dist/404.html`, allowing GitHub Pages to load the React application for an unknown path while React Router reads the original URL. This keeps clean URLs without a hash router. The deployment will use `/` as its base, retain the current custom domain, and include the `CNAME` file in the build output.

### Components

The application will use focused components with clear responsibilities:

- `AppShell` renders navigation, routed content, footer, and the fixed background layer.
- `Navigation` renders desktop and mobile links and indicates the active route.
- `ThemeControl` switches the dark and light themes and persists the choice locally.
- `BackgroundCanvas` owns Three.js setup, rendering, resize handling, pointer input, theme colors, reduced-motion behavior, and cleanup.
- `HomePage` renders the name, introduction, and grouped skillset.
- `Skills` renders skill groups as compact tags without ratings or progress bars.
- `WorksPage` reads the project data and renders the project grid.
- `ProjectCard` renders a media preview, title, and route link.
- `ProjectPage` renders the overview, selected contributions, technology tags, media, and public link when one exists.
- `ContactPage`, `NotFoundPage`, and `Footer` retain the current minimal presentation.

### Project data

One typed project collection will supply both the grid and detail routes. Each project record will contain:

- `slug`
- `title`
- `summary`
- `overview`
- `contributions`
- `technologies`
- `media`
- optional `sourceUrl`
- optional `sourceLabel`

The build or tests will reject duplicate slugs and incomplete project records. Components will not duplicate project copy.

## Visual System

### Preserved style

The implementation will retain:

- Questrial as the primary typeface
- The existing dark and light theme palettes
- The pink/red interaction accent
- The 600px default content width and 900px work width
- The current spacing scale
- Thin muted borders
- Grayscale project media that gains color or accent treatment on interaction
- The Home, Work, and Contact navigation structure
- The compact footer

The migration may adjust CSS implementation details for accessibility and responsive behavior, but it must not introduce a new visual design language.

### Theme behavior

The theme control will use semantic button markup. It will preserve the current compact swatch appearance, expose an accessible label, persist the selected theme, and update the Three.js colors. Theme changes will blend the background colors instead of switching them in a single frame.

## Homepage Content

The homepage will use this introduction:

> **a full-stack software engineer**
>
> I build web and mobile software for operational workflows, business platforms, integrations, and document-heavy systems. My work covers React and TypeScript interfaces, API and ERP integrations, mobile applications, e-invoicing, and document AI.
>
> I work across product UI, backend services, and delivery tooling to turn complex processes into software people can use under real working conditions.

The copy will remain concise and will not include an employer, timeline, education history, or traditional CV summary.

## Skillset

Skills will appear as compact tags under five headings. The interface will not assign ratings or proficiency levels.

### Frontend

TypeScript, JavaScript, React, Redux Toolkit, TanStack Query, Three.js, WebGL, Material UI, Mantine, Sass, Tailwind CSS, Vite

### Backend & Integration

.NET, C#, Node.js, REST APIs, JWT, n8n, Oracle JD Edwards integration

### Mobile

React Native, Expo, Flutter

### Data & Documents

KSeF, XML, XSLT, PDF workflows, JSON, document AI

### Delivery

GitHub Actions, CI/CD, npm package publishing, Vitest, Testing Library

## Projects

The Work page will contain eight entries. Recent private work will use project-area descriptions without company or client attribution. Public WebGL work will retain repository links and existing media.

### Warehouse and Manufacturing Workflows

Scanner-led software for warehouse transfers, production steps, inventory checks, reservations, label printing, and ERP-connected processes. The detail page will describe barcode input, operational validation, device-aware interaction, localisation, and workflow state handling.

### Business Platforms and Approvals

Administration and workflow software for users, permissions, authentication, API configuration, approvals, leave management, scheduling, and vendor processes. The detail page will focus on reusable React and TypeScript architecture, state management, data tables, forms, and shared components.

### E-invoicing and KSeF

Software for invoice integration rules, document handling, logs, PDF and XML flows, and Polish KSeF integration. The detail page will cover frontend workflows and supporting .NET, C#, XSLT, and XML work without exposing business data.

### Document AI

Tools for PDF intake, prompt configuration, document analysis, and structured JSON or text results. The detail page will explain the human review workflow, result presentation, and integration boundaries without presenting private prompts, documents, or customer information.

### Mobile Applications

React Native, Expo, and Flutter applications for authenticated business processes, scanning, file handling, and network-aware workflows. The detail page will cover navigation, API integration, secure storage, testing, and device behavior.

### Endless City

Retain the public WebGL city scene, existing video, project description, technology tags, and GitHub link. Copy may receive minor corrections for clarity.

### Particle Simulation

Retain the public GLSL particle simulation, existing video, project description, technology tags, and GitHub link. Copy may receive minor corrections for clarity.

### Civio

Retain the public procedural hex-map experiment, existing video, project description, technology tags, and GitHub link. Copy may receive minor corrections for clarity.

## Project Media

The three public WebGL projects will keep their grayscale videos. Videos will respect reduced-motion preferences and will not block access to project content if playback fails.

The five private projects will use local monochrome SVG artwork. The illustrations will use grids, lines, workflow nodes, document outlines, and device frames. They will fit the current bordered card format and use the accent color on hover or keyboard focus. They must not contain company marks, client marks, screenshots, private data, or copied product interfaces.

Project detail pages for private work will remain text-focused. Each page will include a short overview, selected contributions, and technology tags.

## Three.js Background

### Visual behavior

The background will preserve the current monochrome wireframe appearance. The new scene will use layered shader noise to create a slow-moving contour surface with greater depth than the existing single plane.

Pointer movement will apply a small camera shift and local deformation. The response must stay restrained so text remains readable. The dark and light themes will provide the scene's wireframe and clear colors. Theme changes will interpolate those colors.

### Rendering lifecycle

`BackgroundCanvas` will:

- Create the renderer, scene, camera, geometry, shader material, and animation clock after mount.
- Cap device pixel ratio to control GPU cost.
- Use `ResizeObserver` to size the renderer from its container.
- Track pointer input without triggering React renders on each event.
- Pause animation when the document becomes hidden.
- Dispose geometry, material, renderer resources, observers, listeners, and animation frames during cleanup.

### Accessibility and fallbacks

For `prefers-reduced-motion: reduce`, the canvas will render a static frame and disable pointer-driven movement. If WebGL creation or shader compilation fails, the application will hide the canvas and retain the theme-colored CSS background. Content, routing, and theme controls will remain functional.

## Accessibility

- Navigation and controls will use semantic elements and keyboard interaction.
- The mobile menu and theme control will expose accessible names and state.
- Focus indicators will use the existing accent color.
- Headings will follow a logical order.
- Images and videos will include descriptive alternative text or adjacent descriptions.
- Project cards will expose one clear link target.
- Text and controls will maintain sufficient contrast in both themes.
- Motion preferences will affect both the background and project videos.

## Error Handling

- An unknown project slug will render the not-found page rather than an empty detail view.
- Missing project media will leave the title and summary usable.
- Video playback failures will not surface unhandled promise rejections.
- WebGL failures will fall back to the CSS background.
- Invalid project data will fail tests or the build before deployment.

## Testing and Verification

Automated checks will cover:

- TypeScript type checking
- Project data completeness and unique slugs
- Route rendering for all pages and project slugs
- Not-found behavior
- Theme switching and persistence
- Reduced-motion behavior
- Background lifecycle helpers where they can be tested without a GPU
- Production build output

Manual browser checks will cover:

- Dark and light themes
- Keyboard navigation and focus states
- Phone, tablet, and desktop layouts
- Project videos and private-project SVG artwork
- WebGL animation quality and readability
- Reduced-motion behavior
- Direct navigation to project routes on the deployment setup

## Deployment

The repository will include a GitHub Actions workflow that installs dependencies with a supported Node version, runs verification, builds the Vite site, and publishes `dist` to GitHub Pages. The build will copy the existing `CNAME` file. The obsolete Universal Analytics `UA-` configuration will be removed, and the refreshed site will ship without analytics.

## Out of Scope

- A traditional CV or employment timeline
- Company and customer attribution for recent private work
- Private source code, screenshots, documents, prompts, URLs, or repository metrics
- A new brand, color palette, type system, or navigation model
- A content management system or backend service
- Analytics replacement
- Changes to the public GitHub profile or its pinned repositories

## Acceptance Criteria

- The site builds with a supported Node release and current dependencies.
- Home, Work, project detail, Contact, and not-found routes work in a static deployment.
- The refreshed site retains the established visual style.
- The homepage presents the approved full-stack introduction and grouped skillset.
- The Work page contains the five approved recent project areas and the three retained WebGL projects.
- Recent project pages reveal no employer, client, timeline, or private material.
- The Three.js background provides the approved contour animation and fallbacks.
- Both themes, responsive layouts, keyboard navigation, and reduced-motion behavior pass verification.
- GitHub Pages deployment retains the custom domain and runs through a supported build workflow.
