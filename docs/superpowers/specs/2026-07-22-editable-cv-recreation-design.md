# Editable CV Recreation Design

## Goal

Recreate the existing `static/tomasz_zielinski.pdf` as an editable Word document and a new PDF while preserving the current one-page design and wording. Keep the original PDF unchanged.

## Deliverables

- `output/docx/tomasz_zielinski_editable.docx`: editable source document.
- `output/pdf/tomasz_zielinski_recreated.pdf`: PDF exported from the editable source.

The existing `static/tomasz_zielinski.pdf` and `output/pdf/tomasz_zielinski-working-copy.pdf` remain unchanged. This task does not replace the PDF served by the website.

## Content Scope

The recreation retains the visible text, section order, dates, contact details, capitalization, and consent statement from the original PDF. It does not add portfolio projects, update employment history, correct dates, or rewrite prose.

The builder may remove extraction artifacts that do not render as visible content, such as zero-width spaces. It will use normal Word paragraph, heading, list, tab-stop, and hyperlink structures so future edits do not depend on positioned text overlays.

## Page and Visual Design

- US Letter portrait, matching the original 612 x 792 point page.
- One page with compact margins and the same visual density as the original.
- Large black serif name at the upper left.
- Website, email, and telephone in small grey text at the upper right.
- Grey serif section headings with black sans-serif body text.
- Bold organization and project names, middle-dot separators, and grey right-aligned dates.
- Real bullets for the freelance experience list.
- Compact project title and description pairs.
- Small consent text along the bottom of the page.

The implementation will use explicit font sizes, spacing, tab stops, and paragraph rules. It will avoid tables and floating text boxes so the document stays editable and maintains a predictable text-reading order.

## Document Structure

The Word document contains these blocks in order:

1. Header block with name and contact information.
2. Professional Experience.
3. Education.
4. Projects.
5. Technical Skills.
6. Consent statement.

Section headings use real Word heading styles. Experience bullets use Word list definitions. Dates share their associated title line through right-aligned tab stops. Website and email text use hyperlinks.

## Generation and Data Flow

1. Read the visible content and geometry from the original PDF.
2. Generate the DOCX with the bundled Python runtime and `python-docx`.
3. Render the DOCX with the bundled document renderer and emit a PDF.
4. Copy the emitted PDF to the final PDF path.
5. Render the recreated PDF to PNG for a second visual check.

Temporary render files stay under `tmp/` and are removed after verification. A failed render, missing font, page overflow, or text mismatch stops delivery until corrected.

## Verification

The final recreation must pass these checks:

- The DOCX and recreated PDF each render as one US Letter page.
- Every original content block appears in the recreated output.
- The name, contact block, headings, dates, bullets, projects, skills, and consent statement have no clipping or overlap.
- Section spacing, typography, grey accents, and alignment match the original closely.
- Text extraction from the recreated PDF follows the visual section order.
- The original PDF hash remains unchanged.

The DOCX and PDF will be rendered to page images and inspected at full resolution before delivery.

## Out of Scope

- Updating employment, education, projects, skills, or contact details.
- Rewriting bullets or adding measurable achievements.
- Replacing `static/tomasz_zielinski.pdf`.
- Redesigning the CV or changing it to A4.
