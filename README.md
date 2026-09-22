# Tomasz Zielinski — Portfolio

Personal portfolio for Tomasz Zielinski, a full-stack developer working across
business platforms, integrations, mobile applications, workflow automation,
e-invoicing, and document AI.

Live site: [corashina.github.io](https://corashina.github.io/)

## Highlights

- Responsive React portfolio with Home, Work, Blog, article, project-detail, and Contact routes.
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

Vitest discovers tests only under `src/` and `scripts/`, so nested worktrees
and generated output are excluded. The suite focuses on routing and accessibility,
media loading and failure recovery, analytics, asset integrity, and build safeguards.

Individual commands are also available:

```bash
npm run test
npm run typecheck
npm run build
```

## Blog publishing

Write each post as one Markdown file in `content/posts/`, with metadata at the top.
Posts are discovered automatically. The first article includes the complete MIBSI
source appendix inside its Markdown file.

See [the publishing guide](docs/blog-publishing.md) and
[the article template](docs/blog-post-template.md) for future posts.

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

## Analytics

The **Corashina** Google Analytics 4 web stream uses public Measurement ID
`G-XN363XBN6Z`, configured in `.env.production`. The Google tag loads automatically in
production builds served from `www.tomasz-zielinski.com`, `tomasz-zielinski.com`,
or `corashina.github.io`. Local
development and localhost previews do not send analytics.

There is no consent popup or cookie settings control. Tracking starts when the
site loads. Google signals and ad personalization are disabled.

In Google Analytics, open **Admin → Data streams → Corashina → Enhanced
measurement** and keep these enabled:

- **Page views**, including **Page changes based on browser history events**
  under its advanced settings. This measures React Router navigation.
- **File downloads** (`file_download`), including clicks on the CV PDF link.
- **Outbound clicks** (`click`), including links to external profiles.

The site also sends `contact_click` with a `contact_method` value (`email`,
`github`, `linkedin`, `stackoverflow`, `twitter`, or `stackexchange`). This measures
link clicks, not completed emails or enquiries. The CV event measures clicks,
not whether a download completed. A social-link click can appear as both a
standard outbound `click` and the distinct `contact_click`; do not sum these as
separate user actions. Page views and downloads rely on enhanced measurement;
the React code does not send duplicate versions of those events.

After deployment, open the live site, navigate to a project, click
the CV and a contact link, and check **Reports → Realtime** for `page_view`,
`file_download`, and `contact_click`. Collection can take up to 30 minutes to
start. Ad blockers can reduce the reported counts. Register
`contact_method` as an event-scoped custom dimension if you want to break down
contact methods in reports, and optionally mark `contact_click` as a key event.

See [Google's setup guide](https://support.google.com/analytics/answer/14183469)
and [SPA measurement guide](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications).

## Deployment

`.github/workflows/deploy-pages.yml` validates and deploys the site to GitHub
Pages whenever `master` is pushed. The custom domain is configured by
`static/CNAME`.

## Repository hygiene

Local Codex state, worktrees, Superpowers-generated planning artifacts, and
generated output are intentionally ignored through `.gitignore`; they are
development aids rather than site source.
