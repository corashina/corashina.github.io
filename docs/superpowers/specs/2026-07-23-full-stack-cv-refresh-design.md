# Full-Stack CV Refresh Design

## Goal

Replace the reconstructed 2018–2019 CV copy with a recruiter-first, two-page
English CV for Full-Stack Engineer roles. The document must reflect Tomasz
Zielinski's verified 2021–2026 commercial experience, current technology
profile, selected commercial product work, education, and strongest personal
projects while remaining public-safe and fully editable.

## Source Authority

Use the following local sources as factual evidence:

- `output/docx/tomasz_zielinski_editable.docx` for the current reconstructed
  CV, contact block, early freelance work, education history, consent language,
  and original visual character.
- `C:\Users\Tomasz\Downloads\Xelto-CV-Experience-Shareable.docx` for public-safe
  Xelto role progression, responsibilities, product scope, and technology
  coverage.
- `C:\Users\Tomasz\Documents\Work\XELTO\deliverables\xelto-proof-of-work\README.md`
  for corroborating public-safe work categories, product context, and
  technology coverage.
- `src/data/projects.ts` for public portfolio project names, descriptions,
  dates, technology labels, and product references.
- `src/pages/ContactPage.tsx` for public contact and profile links.
- `docs/superpowers/specs/2026-07-23-home-full-stack-refresh-design.md` for the
  approved current full-stack positioning and grouped toolkit.
- The University of Southampton's official Summer Graduation 2020 schedule for
  the July 2020 graduation month:
  `https://cdn.southampton.ac.uk/assets/imported/transforms/content-block/UsefulDownloads_Download/9F110025BC104DFF888A0962606F9B73/Simple%20Schedule%202020%20Final%282%29.pdf`.

User-provided decisions override all source material:

- Target Full-Stack Engineer roles.
- Use two pages.
- Do not include private commit metrics or client names.
- List the University of Southampton BSc as completed in July 2020.
- Use Endless City, Flappy-Pixie, and Fitmed as the selected personal projects.

## Audience and Positioning

The primary reader is a technical recruiter or hiring manager evaluating
full-stack engineers for product, platform, integration, or business-system
work. The CV must present Tomasz as a full-stack engineer with strong frontend
depth rather than as a frontend specialist or recent graduate.

The profile will emphasize five years of commercial product delivery across
business platforms, integrations, mobile applications, logistics,
manufacturing, workflow automation, e-invoicing, and document AI. It will
describe work from application architecture through API integration, delivery,
and release without overstating ownership or inventing business outcomes.

## Confidentiality Boundary

The CV may name Xelto and public Xelto product areas. It may describe public-safe
technology, responsibilities, application categories, and role progression.

The CV and evidence folder must not contain:

- Private commit counts or private repository counts.
- Customer or client names.
- Private source code or copied repository trees.
- Credentials, internal URLs, tickets, customer data, or confidential
  implementation details.
- Unsupported performance, revenue, adoption, or productivity claims.

The implementation must run a final text scan for the excluded metrics and
client names present in the source evidence.

## Document Structure

### Page 1

#### Contact header

Include:

- Tomasz Zielinski.
- Role label: `Full-Stack Engineer`.
- `+48 791 748 226`.
- `corashina@gmail.com`.
- `corashina.github.io`.
- `github.com/corashina`.
- `linkedin.com/in/tomasz-zielinski-a97999161`.

Email, website, GitHub, and LinkedIn must be clickable hyperlinks.

#### Profile

Use a concise three-to-four-line profile that communicates:

- Five years of commercial software delivery.
- Full-stack platform and product work.
- Business workflows, integrations, mobile applications, e-invoicing, document
  AI, logistics, and manufacturing.
- Responsibility spanning user-facing applications, APIs and data flows,
  integration, delivery, and release.

#### Core technologies

Present a compact, ATS-readable grouped list:

- Languages: TypeScript, JavaScript, C#, Dart, XSLT/XML.
- Platforms: React, Node.js, .NET, React Native/Expo, Flutter.
- Systems: REST APIs, JWT, n8n, Oracle JD Edwards.
- Delivery: GitHub Actions, CI/CD, npm packages, Vite.

Do not use graphical skill ratings, progress bars, or unsupported proficiency
labels.

#### Professional experience

Use one employer block:

`Xelto | 2021–2026`

Show role progression inside the employer block:

- `Full-Stack Engineer | 2024–2026`
- `Junior Frontend Developer | 2021–2024`

The Full-Stack Engineer bullets should cover:

- Product delivery across platform applications, integrations, reusable
  components, mobile experiences, and operational tooling.
- Administration and system-setup capabilities, workflow approvals,
  e-invoicing/KSeF, document processing, and document-AI interfaces.
- Cross-layer work with React/TypeScript, REST/JWT, React Native/Expo, Flutter,
  .NET/C#, XSLT/XML, and integration tooling.
- Release and maintenance work involving GitHub Actions, configuration,
  versioning, CI/CD, and shared-package publishing.

The Junior Frontend Developer bullets should cover:

- React/JavaScript applications for warehouse and manufacturing workflows.
- Scanner and mobile-device interfaces, process state, validation, barcode
  interaction, label printing, localisation, and API-connected operational
  screens.
- Shared UI and API foundations used across commercial applications.

Keep the combined employer section focused enough to fit page 1 without
reducing body text below 9 pt.

### Page 2

#### Selected commercial product work

Use compact project summaries for:

- Xelcode operational workflows.
- Workflow approvals and business-process handling.
- Document AI/ICR.
- E-invoicing/KSeF.
- XELapps platform setup.
- Mobile applications.

These summaries should explain product purpose, technical contribution, and
relevant stack. They must not repeat the professional-experience bullets
verbatim.

#### Earlier experience

Retain and shorten the 2018 freelance web-development entry. Describe responsive
single-page application components, performance/scalability work, and
search-engine optimization without presenting it as current experience.

#### Selected personal projects

Include exactly these three projects:

- Endless City — JavaScript, Three.js, WebGL, glTF; an interactive infinite city
  scene with a custom glTF 2.0 loader.
- Flappy-Pixie — JavaScript, Three.js, WebGL; a Flappy Bird-style game with a 3D
  parallax background completed as a one-week interview challenge.
- Fitmed — React, Redux, Node.js, Express, MongoDB; a prototype platform for
  dietitians with API integration, authentication, and input validation.

Use clickable GitHub links from `src/data/projects.ts`.

#### Education

Include:

- University of Southampton — BSc Computer Science, July 2020.
- Poznan University of Technology — Information Engineering, 2016–2017.

Remove the obsolete `expected in July 2020` wording and all current-student
language.

#### Additional information

Include:

- Languages: English and Polish.
- The existing personal-data consent clause, set unobtrusively at the bottom of
  page 2.

## Visual System

Preserve the reconstructed CV's restrained visual character:

- US Letter portrait.
- Times New Roman for the name and section headings.
- Calibri for body text, dates, contact details, and labels.
- Black primary text and muted gray secondary text.
- Right-aligned dates.
- Compact but readable vertical rhythm.

Adapt the layout into two pages rather than compressing five years of work into
the original one-page geometry. Body text must remain at least 9 pt. Use real
Word paragraph styles, real bullets, and explicit hyperlink relationships.
Avoid decorative graphics, rating bars, dense sidebars, and text boxes.

The header may use a borderless two-cell table with exact geometry to keep the
identity and contact blocks independently editable. All other content should
use normal Word paragraphs and lists.

## Evidence Folder

Create:

`output/cv-full-stack-2026/`

The folder must contain:

- `Tomasz-Zielinski-Full-Stack-CV.docx`
- `Tomasz-Zielinski-Full-Stack-CV.pdf`
- `sources/current-editable-cv.docx`
- `sources/xelto-public-evidence.md`
- `sources/website-projects.ts`
- `sources/website-contact.tsx`
- `sources/source-manifest.md`

`source-manifest.md` must record each source's original absolute path, copied
filename or `not copied` status, SHA-256 hash, and the facts it contributed.
`xelto-public-evidence.md` must be generated from the approved CV content model
and contain only the public-safe role progression, responsibilities, product
categories, and technology coverage used in the CV.

The raw Xelto DOCX and proof-of-work README contain excluded client names and
private metrics. Record their paths and hashes in the manifest, but do not copy
them into the evidence folder. Do not copy the full XELTO workspace,
repositories, or non-shareable CV insert.

Original source files must remain unchanged.

## Generator and Data Design

Keep the CV reproducible. Store current CV content in structured Python data
for:

- Identity and contact links.
- Profile.
- Technology groups.
- Employment and role progression.
- Commercial project summaries.
- Earlier experience.
- Personal projects.
- Education.
- Languages and consent.

The generator must produce both DOCX and PDF from the same content model so
contact details, dates, titles, and bullets cannot drift between formats.

Update the generator tests before implementation to assert:

- Two-page target structure and section order.
- Current contact details and hyperlinks.
- Full-stack role label.
- Xelto role progression and dates.
- Southampton completion in July 2020.
- Exact personal-project selection.
- Absence of obsolete student language, private metrics, and client names.
- Matching source fonts and editable Word structures.

## Verification

Before delivery:

1. Run the focused generator tests.
2. Generate DOCX and PDF into `output/cv-full-stack-2026/`.
3. Render the DOCX to page PNGs and inspect both pages at 100% zoom.
4. Confirm exactly two pages, with no clipping, overflow, overlap, isolated
   headings, or awkward page breaks.
5. Compare the generated PDF and DOCX text for shared contact, role, date,
   project, and education facts.
6. Run the DOCX accessibility audit and resolve all material findings.
7. Scan generated text and copied sources for excluded private metrics and
   client names.
8. Validate all hyperlinks structurally.
9. Verify source-file hashes and confirm originals were not modified.
10. Run `git diff --check` on implementation files.

The renderer's diagnostic artifacts must remain outside the deliverable folder.
Only the final DOCX, final PDF, and approved evidence sources belong in the
evidence folder.

## Acceptance Criteria

- The CV is a readable, recruiter-first two-page document for Full-Stack
  Engineer roles.
- Five years of Xelto experience and role progression are prominent.
- Commercial product work is concrete but public-safe.
- No private metrics or client names appear.
- The selected personal projects are Endless City, Flappy-Pixie, and Fitmed.
- The University of Southampton degree is listed as completed in July 2020.
- Contact and profile links are current and clickable.
- DOCX and PDF are generated from the same structured content.
- Both pages pass visual QA.
- The evidence folder contains all and only the approved public-safe supporting
  files, a sanitized Xelto evidence summary, and a source manifest that records
  uncopied raw-source hashes.
