# Home Full-Stack Refresh Design

## Goal

Update the Home section so it presents Tomasz Zielinski as a Full-Stack Developer who builds platforms across several languages, frameworks, and business domains. Keep the page compact and preserve the portfolio's restrained visual character.

## Scope

This change applies only to:

- `src/pages/HomePage.tsx`
- `src/pages/HomePage.test.tsx`
- `src/styles/home.module.scss`

The Work page, project data, navigation, global styles, media, and other pages remain unchanged.

The two files from Downloads and the local `Documents/Work/XELTO` workspace serve only as factual references. Do not copy those files into the portfolio. Do not expose private source code, repository details, internal URLs, credentials, customer data, or private metrics.

## Content

The Home page keeps the existing name heading and replaces the obsolete student and aspiring-engineer language.

### Heading

- Name: `Tomasz Zielinski`
- Role: `Full-Stack Developer`

### Introduction

Use this copy:

> I build platforms for business workflows, operational systems, mobile applications, integrations, and document processing. I work across TypeScript, C#, Dart, and XSLT, connecting user-facing products with APIs, data flows, cloud services, and delivery pipelines.
>
> My experience covers logistics, manufacturing, workflow automation, e-invoicing, and document AI. I take products from application architecture through integration and release. I also build WebGL side projects with Three.js.

The introduction must not name Xelto, mention private commit counts, or present Tomasz as a frontend specialist. WebGL appears only in the short final sentence as side-project context.

### Toolkit

Replace the line-broken `i use` list with grouped semantic lists of pills:

- Languages: TypeScript, JavaScript, C#, Dart, XSLT/XML, GLSL
- Platforms: .NET, Node.js, React, React Native/Expo, Flutter, Three.js/WebGL
- Systems: REST APIs, JWT, n8n, Oracle JD Edwards
- Delivery: GitHub Actions, CI/CD, npm packages, Vite

Keep labels in their standard product casing. Store the groups in a typed data structure in `HomePage.tsx`, then render group headings and list items from that structure.

## Layout

Keep an editorial two-column composition on wide screens:

- The main column contains the name, role, and two introduction paragraphs.
- The narrower column contains the grouped toolkit.
- Toolkit content aligns left. Remove the current right-aligned treatment.
- Use a breakpoint that gives both columns enough room for readable copy and wrapping pills. Stack the toolkit below the introduction on narrower screens.
- Preserve the site's existing maximum content width, theme system, navigation spacing, and animated background.

The page should remain a compact introduction rather than a multi-section résumé.

## Pill Styling

Render each technology as a CSS pill instead of an external badge image:

- Use a one-pixel theme border, compact horizontal padding, and a rounded capsule shape.
- Use existing theme variables for text, border, background, and accent colors.
- Let pills wrap within each group.
- Keep group spacing tighter than the space between the introduction and toolkit.
- Apply the accent color to the pill border and text on hover.
- Do not load external badge images, logos, brand colors, or new dependencies.

## Semantics and Accessibility

- Keep the page name as the single `h1`.
- Use `h2` for `Full-Stack Developer`.
- Give the toolkit a descriptive heading.
- Use `h3` headings for toolkit groups.
- Render technologies as `ul` and `li` elements.
- Keep body copy left-aligned and readable; do not justify it.
- Decorative hover styling must not hide labels or reduce contrast.
- The layout must avoid horizontal overflow at supported viewport sizes.

## Data Flow and Failure Handling

The Home section uses static local content and has no runtime data source. Rendering must not depend on the Downloads files, the XELTO workspace, network access, or external badge services.

The toolkit map supplies stable React keys from group and technology names. Empty separators from the old tools array disappear. No loading or error state is required.

## Testing

Update `HomePage.test.tsx` to verify:

- The `Tomasz Zielinski` and `Full-Stack Developer` headings.
- Both approved introduction paragraphs.
- All four toolkit group headings.
- Every approved technology label.
- Technologies render within semantic lists.
- The obsolete `an aspiring software engineer`, student copy, and `i use` heading no longer render.

Run the full test suite, typecheck, and production build. Inspect Home at desktop and mobile widths in both themes. Confirm that pills wrap without clipping and the page has no horizontal overflow.

## Acceptance Criteria

- Home presents Tomasz as a Full-Stack Developer who builds platforms.
- The copy covers platform work, multiple languages, integrations, mobile development, and business domains without naming Xelto.
- WebGL appears only as a short side-project note.
- The broader toolkit appears as four groups of CSS pills.
- The Home layout stays compact and responsive.
- No application file or behavior outside the Home section changes.
