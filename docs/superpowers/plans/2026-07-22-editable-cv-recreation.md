# Editable CV Recreation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the current one-page CV as an editable DOCX and a matching PDF without changing the original PDF or its visible content.

**Architecture:** A focused Python builder defines the CV content and Word layout, then writes a DOCX through `python-docx`. Tests inspect the generated OOXML structure and content. The bundled document renderer exports the DOCX to PDF, and Poppler renders both the source and recreated PDFs for visual comparison.

**Tech Stack:** Bundled Python 3, `python-docx`, LibreOffice through `render_docx.py`, Poppler, `pypdf`, and `unittest`.

## Global Constraints

- Preserve `static/tomasz_zielinski.pdf` unchanged.
- Preserve the original visible wording, dates, contact details, capitalization, section order, and consent statement.
- Use US Letter portrait and produce one page.
- Avoid tables, floating text boxes, and positioned PDF overlays.
- Use Word heading styles, real bullets, right-aligned tab stops, and hyperlinks.
- Write final files to `output/docx/tomasz_zielinski_editable.docx` and `output/pdf/tomasz_zielinski_recreated.pdf`.
- Do not replace `static/tomasz_zielinski.pdf`.

---

### Task 1: Build a deterministic editable CV generator

**Files:**
- Create: `scripts/create_editable_cv.py`
- Test: `scripts/create_editable_cv_test.py`

**Interfaces:**
- Consumes: a `pathlib.Path` output path.
- Produces: `build_cv(output_path: Path) -> Path` and a DOCX containing the approved content and layout.

- [ ] **Step 1: Write structural tests**

Create tests that call `build_cv()` in a temporary directory and assert:

```python
document = Document(result)
assert document.sections[0].page_width == Inches(8.5)
assert document.sections[0].page_height == Inches(11)
assert [p.text for p in document.paragraphs if p.style.name == "Heading 1"] == [
    "Professional Experience",
    "Education",
    "Projects",
    "Technical Skills",
]
assert "Tomasz Zielinski" in "\n".join(p.text for p in document.paragraphs)
assert "I hereby consent" in "\n".join(p.text for p in document.paragraphs)
```

Inspect `word/document.xml` and assert that it contains a right-aligned tab stop and no table or text-box elements:

```python
with ZipFile(result) as archive:
    xml = archive.read("word/document.xml")
assert b'w:val="right"' in xml
assert b"<w:tbl" not in xml
assert b"<w:txbxContent" not in xml
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run:

```powershell
$env:PYTHONPATH='scripts'; & $python 'scripts\create_editable_cv_test.py'
```

Expected: failure because `create_editable_cv` does not exist.

- [ ] **Step 3: Implement the builder**

Create these named units in `scripts/create_editable_cv.py`:

```python
@dataclass(frozen=True)
class Entry:
    title: str
    date: str
    description: tuple[str, ...]

def add_hyperlink(paragraph, text: str, url: str, color: str = "808080") -> None: ...
def add_title_date(document: Document, title_runs: tuple[tuple[str, bool], ...], date: str) -> None: ...
def configure_document(document: Document) -> None: ...
def build_cv(output_path: Path) -> Path: ...
```

The builder must:

- Set Letter page dimensions with explicit margins.
- Define Normal, Heading 1, CV Title, CV Entry, CV Description, CV Bullet, and CV Footer styles.
- Create the name and contact header with right tab stops and line breaks.
- Add each approved section and entry in source order.
- Use Word list formatting for the three freelance bullets.
- Add right-aligned dates on title lines through tab stops.
- Add website and email hyperlinks.
- Create parent directories and save the output path.
- Expose a CLI accepting one output path.

- [ ] **Step 4: Run the structural tests**

Run:

```powershell
$env:PYTHONPATH='scripts'; & $python 'scripts\create_editable_cv_test.py'
```

Expected: all tests pass.

- [ ] **Step 5: Commit the generator and tests**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py
git commit -m "feat: add editable CV generator"
```

---

### Task 2: Generate and render the editable artifacts

**Files:**
- Create: `output/docx/tomasz_zielinski_editable.docx`
- Create: `output/pdf/tomasz_zielinski_recreated.pdf`
- Temporary: `tmp/cv-render/`

**Interfaces:**
- Consumes: `build_cv(output_path: Path) -> Path` from Task 1.
- Produces: one editable DOCX and one PDF exported from that DOCX.

- [ ] **Step 1: Generate the DOCX**

Run:

```powershell
& $python 'scripts\create_editable_cv.py' 'output\docx\tomasz_zielinski_editable.docx'
```

Expected: the DOCX exists and has a non-zero file size.

- [ ] **Step 2: Render the DOCX and emit PDF**

Run:

```powershell
& $python $renderDocx 'output\docx\tomasz_zielinski_editable.docx' --output_dir 'tmp\cv-render' --emit_pdf
```

Expected: `tmp/cv-render/page-1.png` and the emitted PDF exist, with no `page-2.png`.

- [ ] **Step 3: Copy the emitted PDF to the final output**

Copy the emitted PDF to `output/pdf/tomasz_zielinski_recreated.pdf`, preserving the DOCX as the editable source.

- [ ] **Step 4: Inspect the rendered page**

Open `tmp/cv-render/page-1.png` at full resolution. Check the header, all four sections, dates, bullets, project rows, skills, and consent line for overlap, clipping, crowding, and broken glyphs.

- [ ] **Step 5: Adjust and repeat**

If the output spans two pages or differs from the source layout, adjust explicit margins, style sizes, and paragraph spacing in `scripts/create_editable_cv.py`, then rerun the structural tests and all Task 2 rendering steps.

---

### Task 3: Verify fidelity and preserve the original

**Files:**
- Verify: `static/tomasz_zielinski.pdf`
- Verify: `output/docx/tomasz_zielinski_editable.docx`
- Verify: `output/pdf/tomasz_zielinski_recreated.pdf`

**Interfaces:**
- Consumes: the artifacts from Task 2.
- Produces: verification evidence for delivery.

- [ ] **Step 1: Verify file metadata and page count**

Use `pdfinfo` on the recreated PDF. Expected values:

```text
Pages: 1
Page size: 612 x 792 pts (letter)
```

- [ ] **Step 2: Compare extracted content**

Use `pypdf` to extract both PDFs. Normalize blank lines, non-breaking spaces, zero-width spaces, and bullet glyphs. Assert that the recreated PDF contains each source content block in visual section order.

- [ ] **Step 3: Verify the original hash**

Run `Get-FileHash -Algorithm SHA256 static\tomasz_zielinski.pdf` and expect:

```text
901A5FB1190D968C6A216ECBF478AEF23FB66B4BD6BA6755EAAD1680D51D7D51
```

- [ ] **Step 4: Render and inspect the recreated PDF**

Render it with Poppler to `tmp/pdfs/tomasz_zielinski_recreated-1.png`. Inspect the page at full resolution and confirm that the PDF matches the verified DOCX render.

- [ ] **Step 5: Run final automated checks**

Run the generator tests again, confirm both final files are non-empty, confirm one-page output, and run `git diff --check` on source files.

- [ ] **Step 6: Remove QA intermediates**

Delete only the exact PNG and temporary PDF files created under `tmp/cv-render/` and `tmp/pdfs/`. Retain the two final artifacts.
