# Tomasz Zielinski — Portfolio

Personal portfolio for Tomasz Zielinski, a full-stack developer working across
business platforms, integrations, mobile applications, workflow automation,
e-invoicing, and document AI.

Live site: [corashina.github.io](https://corashina.github.io/)

## Highlights

- Responsive React portfolio with Home, Work, project-detail, and Contact routes.
- Commercial, freelance, and experimental projects with image and video media.
- Interactive Three.js particle background with theme and motion preferences.
- Downloadable one-page CV in PDF and editable DOCX formats.
- Automated validation and GitHub Pages deployment from `master`.

## Technology

- React 19 and TypeScript
- Vite
- React Router
- Three.js and GLSL
- Sass modules
- Vitest and Testing Library

## Local development

The project requires Node.js 24 or newer.

```bash
npm ci
npm run dev
```

Vite prints the local preview URL after startup.

## Validation and production build

```bash
npm run verify
```

This runs the Vitest suite, TypeScript checks, the production Vite build, and
SPA fallback generation. The production output is written to `dist/`.

Individual commands are also available:

```bash
npm run test
npm run typecheck
npm run build
```

## Content and assets

- Project metadata: `src/data/projects.ts`
- Portfolio media: `static/portfolio/`
- Website CV download: `static/tomasz_zielinski.pdf`
- Editable CV download: `static/tomasz_zielinski_editable.docx`
- CV generation and packaging scripts: `scripts/`

To regenerate the editable CV and matching PDF:

```bash
python scripts/create_editable_cv.py output/docx/tomasz_zielinski_editable.docx
python scripts/create_editable_cv.py output/pdf/tomasz_zielinski_recreated.pdf --pdf
```

The `output/` directory is intentionally local and ignored. Publishable CV
copies live in `static/`, where Vite includes them in the deployed site.

## Deployment

`.github/workflows/deploy-pages.yml` validates and deploys the site to GitHub
Pages whenever `master` is pushed. The custom domain is configured by
`static/CNAME`.

## Repository hygiene

Local Codex state, worktrees, Superpowers-generated planning artifacts, and
generated output are intentionally ignored through `.gitignore`; they are
development aids rather than site source.
