# One-Page CV Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce matching one-page DOCX and PDF CVs with clearer employer and role hierarchy, reordered sections, no social or project links, and the approved content changes.

**Architecture:** Keep `full_stack_cv_content.py` as the shared content source and keep both renderers in `create_editable_cv.py`. Update tests before each behavior change. Reuse the existing packager so the final bundle retains its source manifest and confidentiality controls.

**Tech Stack:** Python 3, python-docx, ReportLab, pypdf, unittest, Poppler, Aspose.Words for local DOCX render QA

## Global Constraints

- Preserve the current Times New Roman and Calibri visual system.
- Preserve the black and muted-gray palette.
- Use US Letter portrait with margins no smaller than 0.4 inches.
- Keep body text at or above 8.5 pt.
- Keep a single-column layout.
- Keep Endless City, Flappy-Pixie, and Fitmed as the only selected personal projects.
- Remove GitHub, LinkedIn, personal-project hyperlinks, and visible `View project` text.
- Keep private metrics and client names out of every public artifact.
- The DOCX and PDF must each contain exactly one page.

---

### Task 1: Update the shared CV content

**Files:**
- Modify: `scripts/full_stack_cv_content.py:103-108`
- Modify: `scripts/create_editable_cv_test.py:16-270`

**Interfaces:**
- Consumes: Existing immutable `CvData` data class.
- Produces: `CV_DATA.profile` with the approved ownership sentence. Link removal remains a renderer responsibility in Tasks 2 and 3 so the source model can retain project provenance.

- [ ] **Step 1: Write failing content tests**

Add this assertion to `EditableCvBuilderTest`:

```python
def test_profile_contains_the_approved_ownership_sentence(self) -> None:
    self.assertIn(
        "I translate operational requirements into maintainable systems and "
        "take ownership across the delivery lifecycle.",
        CV_DATA.profile,
    )
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest `
  scripts.create_editable_cv_test.EditableCvBuilderTest.test_profile_contains_the_approved_ownership_sentence `
  -v
```

Expected: FAIL because the profile lacks the sentence.

- [ ] **Step 3: Update the profile**

Append this sentence to `CV_DATA.profile`:

```python
" I translate operational requirements into maintainable systems and take "
"ownership across the delivery lifecycle."
```

- [ ] **Step 4: Run the content tests and the full module**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest scripts.create_editable_cv_test -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- scripts/full_stack_cv_content.py scripts/create_editable_cv_test.py
git commit -m "feat: refine one-page CV content"
```

---

### Task 2: Rebuild the editable DOCX as one page

**Files:**
- Modify: `scripts/create_editable_cv.py:280-549`
- Modify: `scripts/create_editable_cv_test.py:16-270`

**Interfaces:**
- Consumes: Updated `CV_DATA` from Task 1.
- Produces: `build_cv(output_path: Path) -> Path`, generating the approved one-page DOCX with a distinct `CV Company` style.

- [ ] **Step 1: Replace old layout expectations with failing one-page expectations**

Update the expected section headings:

```python
self.assertEqual(
    headings,
    [
        "Profile",
        "Education",
        "Professional Experience",
        "Commercial Experience",
        "Technologies",
        "Selected Projects",
        "Additional Information",
    ],
)
```

Add structural tests:

```python
def test_docx_uses_one_page_structure_without_social_links(self) -> None:
    with ZipFile(self.output_path) as archive:
        document_xml = archive.read("word/document.xml")
        relationships_xml = archive.read("word/_rels/document.xml.rels")

    self.assertEqual(document_xml.count(b'w:type="page"'), 0)
    self.assertNotIn(b"github.com/corashina", document_xml)
    self.assertNotIn(b"linkedin.com/in/", document_xml)
    self.assertNotIn(b"View project", document_xml)
    self.assertNotIn(b"github.com/corashina", relationships_xml)

def test_docx_distinguishes_company_from_role(self) -> None:
    company_paragraph = next(
        paragraph for paragraph in self.document.paragraphs
        if paragraph.text.startswith("Xelto")
    )
    role_paragraph = next(
        paragraph for paragraph in self.document.paragraphs
        if paragraph.text.startswith("Full-Stack Engineer")
    )
    self.assertEqual(company_paragraph.style.name, "CV Company")
    self.assertEqual(role_paragraph.style.name, "CV Entry")
    self.assertNotEqual(
        company_paragraph.style.font.name,
        role_paragraph.style.font.name,
    )
    self.assertGreater(
        company_paragraph.style.font.size.pt,
        role_paragraph.style.font.size.pt,
    )

def test_freelance_work_is_inside_professional_experience(self) -> None:
    texts = [paragraph.text for paragraph in self.document.paragraphs]
    professional = texts.index("Professional Experience")
    commercial = texts.index("Commercial Experience")
    freelance = next(
        index for index, text in enumerate(texts)
        if text.startswith("Freelance Web Development")
    )
    self.assertLess(professional, freelance)
    self.assertLess(freelance, commercial)
    self.assertNotIn("Earlier Experience", texts)
```

Update contact tests to expect only:

```python
("corashina.github.io", "corashina@gmail.com", "+48 791 748 226")
```

- [ ] **Step 2: Run the DOCX tests and verify RED**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest scripts.create_editable_cv_test.EditableCvBuilderTest -v
```

Expected: FAIL on the old headings, page break, social links, missing `CV Company` style, and freelance placement.

- [ ] **Step 3: Apply compact one-page style tokens**

Use these exact DOCX tokens in `configure_document`:

```python
section.top_margin = Inches(0.42)
section.bottom_margin = Inches(0.4)
section.left_margin = Inches(0.5)
section.right_margin = Inches(0.5)

_set_style_font(normal, SANS_FONT, 8.5, INK)
_set_style_font(heading, SERIF_FONT, 13.5, MUTED)
heading.paragraph_format.space_before = Pt(5.5)
heading.paragraph_format.space_after = Pt(1.5)

_set_style_font(title, SERIF_FONT, 26, INK)
_set_style_font(contact, SANS_FONT, 8.5, MUTED)
contact.paragraph_format.line_spacing = Pt(9.5)

company = _add_style(document, "CV Company")
_set_style_font(company, SERIF_FONT, 10.5, MUTED, bold=True)
company.paragraph_format.space_before = Pt(1.5)
company.paragraph_format.space_after = Pt(0)

_set_style_font(entry, SANS_FONT, 9, INK, bold=True)
entry.paragraph_format.space_before = Pt(1.5)
_set_style_font(description, SANS_FONT, 8.5, INK)
description.paragraph_format.space_after = Pt(1)
_set_style_font(skill, SANS_FONT, 8.5, INK)
skill.paragraph_format.space_after = Pt(0.5)
_set_style_font(bullet, SANS_FONT, 8.5, INK)
bullet.paragraph_format.space_after = Pt(0.4)
_set_style_font(footer, SANS_FONT, 7.5, INK)
footer.paragraph_format.space_before = Pt(3)
```

Update the header table to use a 4.65-inch left cell and a 2.85-inch right
cell. Render only website, email, and phone:

```python
contact_rows = (
    (data.identity.website_text, data.identity.website_url, True),
    (data.identity.email, f"mailto:{data.identity.email}", True),
    (data.identity.phone, "", False),
)
```

- [ ] **Step 4: Add employer hierarchy and reorder sections**

Create a company-specific title/date helper:

```python
def _add_company(document: Document, company: str, period: str) -> None:
    paragraph = document.add_paragraph(style="CV Company")
    paragraph.paragraph_format.tab_stops.add_tab_stop(
        CONTENT_WIDTH,
        WD_TAB_ALIGNMENT.RIGHT,
    )
    paragraph.add_run(company)
    date = paragraph.add_run(f"\t{period}")
    _set_font(date, SANS_FONT, 8.5, MUTED)
```

Change `_add_role` to keep `CV Entry` for role titles.

Rebuild `build_cv` in this order:

```python
_add_header(document, CV_DATA)

_add_section_heading(document, "Profile")
_add_description(document, CV_DATA.profile)

_add_section_heading(document, "Education")
for education in CV_DATA.education:
    add_title_date(document, ((education.institution, True),), education.period)
    _add_description(document, education.qualification)

_add_section_heading(document, "Professional Experience")
_add_company(document, CV_DATA.employment.company, CV_DATA.employment.period)
for role in CV_DATA.employment.roles:
    _add_role(document, role, bullet_number_id)
add_title_date(
    document,
    (("Freelance Web Development", True), ("  ·  Poznan, Poland", False)),
    "May–August 2018",
)
_add_description(document, CV_DATA.earlier_experience[1])

_add_section_heading(document, "Commercial Experience")
for project in CV_DATA.commercial_projects:
    _add_project(document, project, include_link=False)

_add_section_heading(document, "Technologies")
for label, technologies in CV_DATA.technology_groups:
    _add_labeled_line(document, f"{label}:  ", ", ".join(technologies), after=0.5)

_add_section_heading(document, "Selected Projects")
for project in CV_DATA.personal_projects:
    _add_project(document, project, include_link=False)

_add_section_heading(document, "Additional Information")
_add_labeled_line(document, "Languages:  ", ", ".join(CV_DATA.languages), after=0.5)
document.add_paragraph(CV_DATA.consent, style="CV Footer")
```

Change `_add_project` to accept `include_link: bool = False` and add no
hyperlink when false. Remove `document.add_page_break()`.

- [ ] **Step 5: Run DOCX tests and verify GREEN**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest scripts.create_editable_cv_test.EditableCvBuilderTest -v
```

Expected: all DOCX tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py
git commit -m "feat: build compact one-page CV DOCX"
```

---

### Task 3: Match the one-page PDF

**Files:**
- Modify: `scripts/create_editable_cv.py:552-785`
- Modify: `scripts/create_editable_cv_test.py:230-270`

**Interfaces:**
- Consumes: Updated `CV_DATA` and the approved DOCX hierarchy.
- Produces: `build_pdf(output_path: Path) -> Path`, generating one page with only website, email, and phone annotations.

- [ ] **Step 1: Write failing PDF tests**

Replace the two-page assertion and add link checks:

```python
def test_builds_one_page_pdf_with_approved_hierarchy_and_links(self) -> None:
    with tempfile.TemporaryDirectory() as temporary_directory:
        output = Path(temporary_directory) / "cv.pdf"
        build_pdf(output)
        reader = PdfReader(output)
        self.assertEqual(len(reader.pages), 1)
        text = reader.pages[0].extract_text()
        for heading in (
            "Profile",
            "Education",
            "Professional Experience",
            "Commercial Experience",
            "Technologies",
            "Selected Projects",
            "Additional Information",
        ):
            self.assertIn(heading, text)
        for removed in (
            "Core Technologies",
            "Selected Product Work",
            "Earlier Experience",
            "github.com/corashina",
            "linkedin.com/in/",
            "View project",
        ):
            self.assertNotIn(removed, text)

        annotations = reader.pages[0].get("/Annots", [])
        uris = [
            annotation.get_object().get("/A", {}).get("/URI", "")
            for annotation in annotations
        ]
        self.assertFalse(any("github.com" in uri for uri in uris))
        self.assertFalse(any("linkedin.com" in uri for uri in uris))
```

- [ ] **Step 2: Run the PDF test and verify RED**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest `
  scripts.create_editable_cv_test.EditableCvBuilderTest.test_builds_one_page_pdf_with_approved_hierarchy_and_links `
  -v
```

Expected: FAIL because the current PDF has two pages, old headings, and social annotations.

- [ ] **Step 3: Implement the compact PDF tokens and order**

Change `_pdf_header` to draw three contact rows at y positions 748, 735, and
722, then return `700`.

Use these tokens:

```python
PDF_BODY = 8.5
PDF_LEADING = 9.5
PDF_SECTION = 13.5
```

Change `_pdf_section` to subtract 18 points. Change body helpers to use
`PDF_BODY` and `PDF_LEADING`. Add:

```python
def _pdf_company(
    pdf: canvas.Canvas,
    company: str,
    date: str,
    y: float,
) -> float:
    pdf.setFillColor(PDF_MUTED)
    pdf.setFont(PDF_SERIF, 10.5)
    pdf.drawString(40, y, company)
    pdf.setFont(PDF_SANS, 8.5)
    pdf.drawRightString(572, y, date)
    return y - 11
```

Render the same section order as Task 2. Render freelance work after the Xelto
roles and before `Commercial Experience`. Render technologies after commercial
work. Change `_pdf_project` to accept `include_link: bool = False`. Do not call
`pdf.showPage()` until all content and consent text have been drawn. Do not call
`linkURL` for personal projects.

- [ ] **Step 4: Run the full test suite and verify GREEN**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' `
  -m unittest discover -s scripts -p '*_test.py' -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py
git commit -m "feat: add matching one-page CV PDF"
```

---

### Task 4: Generate, render, audit, and package the deliverables

**Files:**
- Generate: `tmp/Tomasz-Zielinski-Full-Stack-CV.docx`
- Generate: `tmp/Tomasz-Zielinski-Full-Stack-CV.pdf`
- Update: `output/cv-full-stack-2026/Tomasz-Zielinski-Full-Stack-CV.docx`
- Update: `output/cv-full-stack-2026/Tomasz-Zielinski-Full-Stack-CV.pdf`
- Update: `output/cv-full-stack-2026/sources/source-manifest.md`

**Interfaces:**
- Consumes: `build_cv`, `build_pdf`, and `package_bundle`.
- Produces: The final public-safe one-page bundle.

- [ ] **Step 1: Generate staging files**

```powershell
$python = 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $python scripts/create_editable_cv.py 'tmp\Tomasz-Zielinski-Full-Stack-CV.docx'
& $python scripts/create_editable_cv.py 'tmp\Tomasz-Zielinski-Full-Stack-CV.pdf' --pdf
```

Expected: both commands exit 0.

- [ ] **Step 2: Render the DOCX and verify one page**

Use the locally installed Aspose.Words package to convert the staging DOCX to
`tmp/qa-one-page/docx-render.pdf`. Confirm `document.page_count == 1`.

```powershell
New-Item -ItemType Directory -Force -Path 'tmp\qa-one-page' | Out-Null
$env:PYTHONPATH = 'C:\Users\Tomasz\Documents\Projects\corashina.github.io\.worktrees\recreate-editable-cv\tmp\python-packages'
& $python -c "import aspose.words as aw; source=r'tmp\Tomasz-Zielinski-Full-Stack-CV.docx'; target=r'tmp\qa-one-page\docx-render.pdf'; document=aw.Document(source); print('PAGE_COUNT='+str(document.page_count)); document.save(target)"
```

Expected: `PAGE_COUNT=1`.

Rasterize with:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe' `
  -png -r 144 `
  'tmp\qa-one-page\docx-render.pdf' `
  'tmp\qa-one-page\docx-page'
```

Open `docx-page-1.png` at original resolution. Check the bottom consent line,
right-aligned dates, employer/role contrast, and project descriptions.

- [ ] **Step 3: Render and inspect the PDF**

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin\pdftoppm.exe' `
  -png -r 144 `
  'tmp\Tomasz-Zielinski-Full-Stack-CV.pdf' `
  'tmp\qa-one-page\pdf-page'
```

Open `pdf-page-1.png` at original resolution and apply the same checks.

If either render clips or creates a second page, add a failing regression test
where the defect can be checked structurally, adjust spacing in the order
defined by the design, regenerate, and inspect again.

- [ ] **Step 4: Run document audits**

Run:

```powershell
$scripts = 'C:\Users\Tomasz\.codex\plugins\cache\openai-primary-runtime\documents\26.715.12143\skills\documents\scripts'
& $python "$scripts\a11y_audit.py" 'tmp\Tomasz-Zielinski-Full-Stack-CV.docx'
& $python "$scripts\table_geometry.py" 'tmp\Tomasz-Zielinski-Full-Stack-CV.docx'
```

Expected: zero high-severity accessibility findings. The existing borderless
header layout table may retain the known non-semantic header-row warning.

- [ ] **Step 5: Package from the current main-worktree sources**

```powershell
& $python scripts/package_full_stack_cv.py `
  --docx 'tmp\Tomasz-Zielinski-Full-Stack-CV.docx' `
  --pdf 'tmp\Tomasz-Zielinski-Full-Stack-CV.pdf' `
  --output-dir 'C:\Users\Tomasz\Documents\Projects\corashina.github.io\output\cv-full-stack-2026' `
  --baseline-docx 'C:\Users\Tomasz\Documents\Projects\corashina.github.io\output\docx\tomasz_zielinski_editable.docx' `
  --website-projects 'C:\Users\Tomasz\Documents\Projects\corashina.github.io\src\data\projects.ts' `
  --website-contact 'C:\Users\Tomasz\Documents\Projects\corashina.github.io\src\pages\ContactPage.tsx'
```

Expected: seven bundle files, with private Xelto sources recorded by hash and
not copied.

- [ ] **Step 6: Run final verification**

Run:

```powershell
& $python -m unittest discover -s scripts -p '*_test.py' -v
& $python -m compileall -q `
  scripts\create_editable_cv.py `
  scripts\full_stack_cv_content.py `
  scripts\package_full_stack_cv.py
git diff --check
```

Verify the final DOCX and PDF each have one page; required facts remain; social
and project links are absent; forbidden terms are absent; source hashes match;
and the original working-copy PDF retains SHA-256
`901A5FB1190D968C6A216ECBF478AEF23FB66B4BD6BA6755EAAD1680D51D7D51`.

- [ ] **Step 7: Commit any final generator or test corrections**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py scripts/full_stack_cv_content.py
git commit -m "fix: finalize one-page CV layout"
```

Skip this commit when no tracked files changed after the Task 3 commit.
