# Cosmic Genesis Project Extraction Design

## Goal

Move Cosmic Genesis out of the portfolio repository into a portable, self-contained project at:

`C:\Users\Tomasz\Documents\Projects\cosmic-genesis`

The destination must install, develop, test, build, preview, and run without reading files from or writing files to the portfolio repository.

## Chosen Approach

Perform a clean standalone extraction without preserving Git history and without initializing a new Git repository. Move the tracked application, tests, browser tests, scripts, static assets, package metadata, and relevant Cosmic Genesis documentation to the destination. Do not move generated dependency, build, or test-output directories.

After the destination is verified, remove the corresponding Cosmic Genesis application and documentation from the portfolio worktree. The portfolio runtime has no application imports from Cosmic Genesis, so no replacement component or route is required.

## Standalone Project Boundary

The destination owns:

- `src/`: application, particle simulation, rendering, interaction, runtime, and UI code.
- `e2e/`: Chromium browser coverage.
- `public/`: committed fallback artwork and other static assets.
- `scripts/`: fallback capture tooling.
- `docs/`: the Cosmic Genesis records whose names contain `cosmic-genesis`,
  `particle-only-showcase`, or `particle-lab-controls`, including this
  extraction design and its implementation plan.
- Root project files: `index.html`, `package.json`, `package-lock.json`, TypeScript, Vite, and Playwright configuration.
- A standalone `.gitignore`.
- A rewritten `README.md` containing commands executed from the destination root.

The destination does not own or reference portfolio source, portfolio build output, portfolio scripts, or the portfolio's `public/showcase` directory.

## Portability Changes

- Configure Vite for portable root/relative asset output instead of the portfolio-only `/showcase/` base.
- Change HTML fallback artwork references to portable paths.
- Change Playwright navigation and web-server readiness checks from `/showcase/` to `/`.
- Change fallback capture navigation from `/showcase/` to `/`.
- Remove the `build:portfolio` package script.
- Remove portfolio-specific deployment instructions from the README.
- Preserve the existing application behavior, visual design, particle defaults, parameter panel, FPS counter, accessibility, and reduced-motion handling.

## Data and Runtime Flow

`index.html` loads the TypeScript entry point through Vite. `ShowcaseApp` continues to own rendering, simulation, interaction, recovery, and cleanup. The parameter panel sends transient values to `ShowcaseApp`, which routes simulation parameters to `ParticleSimulation` and bloom strength to `RenderPipeline`. No persistence, network API, or portfolio integration is introduced.

## Error Handling

Existing WebGL capability fallback and context-loss recovery remain unchanged. The fallback asset must resolve both in Vite development and in the production build. Extraction must stop before deleting any source from the portfolio worktree if the destination cannot be created or copied completely.

If the destination already exists and is non-empty, implementation must stop rather than overwrite it without explicit approval.

## Verification

Verification runs from `C:\Users\Tomasz\Documents\Projects\cosmic-genesis`:

1. Install exact locked dependencies with `npm ci`.
2. Run `npm run typecheck`.
3. Run all unit tests and confirm the expected suite passes.
4. Run `npm run build`.
5. Run Chromium browser coverage against `/`.
6. Launch the production preview at `http://127.0.0.1:4174/` and inspect the live scene for visible particles, working controls, an updating FPS counter, and browser console errors.

After the extraction, search the portfolio worktree for active Cosmic Genesis application paths or deployment hooks. Historical Git commits are outside the scope of cleanup.

## Acceptance Criteria

- The destination project works without the portfolio repository.
- The destination contains no portfolio-specific build command or `/showcase/` runtime dependency.
- The portfolio worktree contains no active Cosmic Genesis source, assets, deployment hook, or project documentation.
- Generated directories are not transferred.
- The live standalone preview is available for user testing at the root URL.
- No new Git repository is initialized in the destination.
