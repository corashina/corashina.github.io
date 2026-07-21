# Original Portfolio with Constellation Background Design

## Goal

Recreate the original portfolio's appearance, content, navigation, transitions, themes, media, and responsive behavior from commit `b29b772`, while preserving the reviewed constellation particle background from branch `codex/particle-constellation-background`.

## Source-of-Truth Boundaries

- Commit `b29b772` is the source of truth for visible copy, project data, media, routes, typography, spacing, colors, layout, navigation, footer, page transitions, and responsive behavior.
- The current particle branch is the source of truth for the background renderer, shaders, pointer interaction, adaptive quality, reduced-motion behavior, theme interpolation, failure handling, and resource disposal.
- The implementation keeps the modern Vite, React, TypeScript, and test foundation. It does not restore the obsolete Gatsby 2 runtime or generated `public/` build artifacts.
- The incomplete uncommitted rollback in the main checkout is not an implementation base and must remain untouched.

## Architecture

Implementation continues from the preserved particle branch in an isolated worktree. The existing modern application shell is reshaped to reproduce the original site. The original Gatsby components are treated as behavioral and visual references, not copied back as a runtime dependency.

The application remains divided into these responsibilities:

- The React router owns `/`, `/works`, `/works/:slug`, `/contact`, and the not-found route.
- The shell owns the original width rules, navigation, mobile menu, theme control, forward/back transitions, footer, and document titles.
- Page components own the original homepage, Works, project-detail, Contact, and 404 copy and structure.
- A typed project-data module owns the original seven entries verbatim.
- Project media components own grayscale presentation plus hover play, pause, reset, and color-reveal behavior.
- `BackgroundCanvas` and the Three.js modules remain the single particle-rendering boundary.

## Content and Routes

The homepage restores the original `Tomasz Zielinski` heading, `an aspiring software engineer` introduction, both original biography paragraphs, and the original `i use` technology list.

Works restores these seven entries verbatim and in the original order:

1. WebGL-Minecraft
2. Endless-City
3. Flappy-Pixie
4. Civio
5. Particle Simulation
6. Fitmed
7. Kiteprint

Each project retains its original description, tools, date, media filename, and GitHub link from `src/data/works.json` at `b29b772`. Local media is restored from that commit. Project routes use stable slugs under `/works/:slug` and preserve the original visible titles and link behavior.

Contact restores the original email, résumé, GitHub, Stack Overflow, LinkedIn, Twitter, and Stack Exchange flair content. The footer retains the original copyright format with the current year.

## Visual Presentation

The original Questrial typography and CSS-variable themes are restored. The default theme is dark.

The exact original presentation contracts are:

- Default content width: 600px.
- Works and project-detail width: 900px.
- Global spacing token: 1.5rem.
- Responsive breakpoints: 480px and 768px.
- Dark palette: background `#222`, primary `#ccc`, secondary `#666`, border `#444`, accent `#f44263`.
- White palette: background `#fff`, primary `#000`, secondary `#aaa`, border `#ccc`, accent `#880000`.
- Navigation uses the original bottom border, 5rem content separation, desktop inline links, and collapsible mobile menu.
- Works uses one, two, then three columns at the original breakpoints.
- Media is grayscale by default and reveals color over 400ms on hover.
- Page transitions slide and fade over 500ms, with direction reversed for browser-back navigation.

Accessibility improvements may be made when they do not change visible appearance. Interactive icons use semantic buttons and accessible names; decorative canvas output remains hidden from assistive technology.

## Particle Integration

The original wireframe plane is not restored. The reviewed constellation field remains fixed behind the page with one ambient `THREE.Points` draw, instanced signal nodes, bounded batched connections, GPU-driven motion, and the existing high/medium/low quality profiles.

The original theme state becomes the single source of truth for both CSS variables and particle palettes. Theme changes update page colors and particle uniforms together. The particle background retains:

- Pointer bending, speed-driven energy, waves, clusters, luminous currents, and traveling connection pulses.
- Touch autonomy.
- Reduced-motion static medium-density rendering.
- The development-only `?motion=full` test override.
- Visibility pause/resume, frame-delta cap, DPR cap, adaptive quality downgrade, failure fallback, and idempotent cleanup.

If WebGL creation or rendering fails, the canvas hides and the original solid theme background remains fully usable.

## Interaction Details

- Home, Work, and Contact links reproduce the original labels and active-link treatment.
- The mobile menu opens and closes with the original compact presentation and closes after navigation.
- Theme starts dark and toggles between dark and white without changing page geometry.
- Project videos play when hovered, pause on exit, and reset to time zero. Images and videos share the original grayscale/color-reveal treatment.
- Route changes use the original 500ms forward slide. Browser-back navigation uses the reversed slide.
- Project detail pages retain the original two-column media/details layout above 480px and a single column below it.

## Testing and Verification

Automated tests lock:

- The exact homepage copy and technology list.
- The seven project entries, their order, fields, links, and slug mapping.
- Home, Works, detail, Contact, and not-found routing.
- Original navigation labels, active state, mobile menu, theme toggle, and footer.
- Original width, palette, breakpoint, grid, border, typography, transition-duration, and grayscale style contracts.
- Video hover play, pause, reset, and image rendering.
- Coordinated CSS and particle theme updates.
- Existing particle data, shaders, batching, quality, lifecycle, reduced-motion, override, failure, and disposal behavior.

Full verification includes the complete test suite, TypeScript, production Vite build, SPA fallback, and diff hygiene.

Manual browser checks cover:

- Dark and white themes at desktop width.
- Home, Works, all project-detail layouts, Contact, and 404.
- Mobile navigation and single-column layouts at 390x844.
- Forward and backward page transitions.
- Video hover behavior and grayscale reveal.
- Normal particle motion at `?motion=full`, pointer response, and autonomous return.
- Static reduced-motion presentation without the override.
- Text readability and particle containment on short and long pages.

## Acceptance Criteria

- A visitor sees the original `b29b772` portfolio design and content, not the refreshed portfolio presentation.
- Original navigation, themes, transitions, media behavior, routes, responsive layout, and contact/project content behave as specified.
- The reviewed constellation particle background remains the only background animation and works in both themes.
- Production retains accessibility, performance adaptation, failure fallback, and clean resource disposal.
- The legacy Gatsby runtime and generated original `public/` artifacts are not required.
- The main checkout's existing uncommitted rollback remains preserved until the finished hybrid is explicitly integrated.
