# Full-Stack CV Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a recruiter-first, public-safe, two-page Full-Stack Engineer CV and a self-contained evidence folder from the approved local sources.

**Architecture:** Separate verified CV content from rendering so DOCX and PDF consume one structured data model. Extend the existing Python generator with explicit two-page Word/PDF layouts, then use a dedicated packager to copy only approved public-safe sources and produce a SHA-256 manifest.

**Tech Stack:** Python 3.13, python-docx, ReportLab, pypdf, Poppler, Aspose.Words diagnostic renderer, unittest

## Global Constraints

- Target Full-Stack Engineer roles with a recruiter-first chronological structure.
- Produce exactly two pages in DOCX and PDF.
- Keep Times New Roman for identity/section headings and Calibri for body text.
- Keep body text at 9 pt or larger.
- Include Xelto role progression: Junior Frontend Developer (2021–2024), Full-Stack Engineer (2024–2026).
- Include no private commit metrics, private repository counts, or client names.
- Include Endless City, Flappy-Pixie, and Fitmed as the only personal projects.
- List University of Southampton, BSc Computer Science, July 2020.
- Keep current phone, email, website, GitHub, and LinkedIn links.
- Preserve all original source files.
- Package only approved public-safe supporting files.
- Generate DOCX and PDF from the same structured content model.

---

### Task 1: Create the verified public-safe CV content model

**Files:**
- Create: `scripts/full_stack_cv_content.py`
- Modify: `scripts/create_editable_cv_test.py`
- Test: `scripts/create_editable_cv_test.py`

**Interfaces:**
- Consumes: approved facts in `docs/superpowers/specs/2026-07-23-full-stack-cv-refresh-design.md`
- Produces: immutable `CV_DATA: CvData`, `FORBIDDEN_PUBLIC_TERMS`, and data classes consumed by both renderers

- [ ] **Step 1: Add failing tests for current content and confidentiality**

Add imports:

```python
from full_stack_cv_content import CV_DATA, FORBIDDEN_PUBLIC_TERMS
```

Add tests:

```python
def test_full_stack_content_model_contains_approved_current_facts(self) -> None:
    self.assertEqual(CV_DATA.identity.role, "Full-Stack Engineer")
    self.assertEqual(CV_DATA.identity.phone, "+48 791 748 226")
    self.assertEqual(CV_DATA.identity.email, "corashina@gmail.com")
    self.assertEqual(CV_DATA.identity.website_text, "corashina.github.io")
    self.assertEqual(
        [(role.title, role.period) for role in CV_DATA.employment.roles],
        [
            ("Full-Stack Engineer", "2024–2026"),
            ("Junior Frontend Developer", "2021–2024"),
        ],
    )
    self.assertEqual(
        [project.title for project in CV_DATA.personal_projects],
        ["Endless City", "Flappy-Pixie", "Fitmed"],
    )
    self.assertEqual(CV_DATA.education[0].period, "July 2020")

def test_public_content_excludes_private_metrics_and_client_names(self) -> None:
    visible = CV_DATA.visible_text()
    for forbidden in FORBIDDEN_PUBLIC_TERMS:
        self.assertNotIn(forbidden.casefold(), visible.casefold())
```

- [ ] **Step 2: Run the focused tests and confirm they fail**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test.EditableCvBuilderTest.test_full_stack_content_model_contains_approved_current_facts scripts.create_editable_cv_test.EditableCvBuilderTest.test_public_content_excludes_private_metrics_and_client_names -v
```

Expected: import failure because `full_stack_cv_content.py` does not exist.

- [ ] **Step 3: Implement the immutable content model**

Create `scripts/full_stack_cv_content.py` with:

```python
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Identity:
    name: str
    role: str
    phone: str
    email: str
    website_text: str
    website_url: str
    github_text: str
    github_url: str
    linkedin_text: str
    linkedin_url: str


@dataclass(frozen=True)
class Role:
    title: str
    period: str
    bullets: tuple[str, ...]


@dataclass(frozen=True)
class Employment:
    company: str
    period: str
    roles: tuple[Role, ...]


@dataclass(frozen=True)
class Project:
    title: str
    period: str
    tools: str
    description: str
    url: str = ""


@dataclass(frozen=True)
class Education:
    institution: str
    qualification: str
    period: str


@dataclass(frozen=True)
class CvData:
    identity: Identity
    profile: str
    technology_groups: tuple[tuple[str, tuple[str, ...]], ...]
    employment: Employment
    commercial_projects: tuple[Project, ...]
    earlier_experience: tuple[str, ...]
    personal_projects: tuple[Project, ...]
    education: tuple[Education, ...]
    languages: tuple[str, ...]
    consent: str

    def visible_text(self) -> str:
        values = [
            self.identity.name,
            self.identity.role,
            self.identity.phone,
            self.identity.email,
            self.identity.website_text,
            self.identity.github_text,
            self.identity.linkedin_text,
            self.profile,
            self.employment.company,
            self.employment.period,
            self.consent,
        ]
        for label, technologies in self.technology_groups:
            values.extend((label, *technologies))
        for role in self.employment.roles:
            values.extend((role.title, role.period, *role.bullets))
        for project in (*self.commercial_projects, *self.personal_projects):
            values.extend((project.title, project.period, project.tools, project.description))
        values.extend(self.earlier_experience)
        for education in self.education:
            values.extend((education.institution, education.qualification, education.period))
        values.extend(self.languages)
        return "\n".join(values)


CV_DATA = CvData(
    identity=Identity(
        name="Tomasz Zielinski",
        role="Full-Stack Engineer",
        phone="+48 791 748 226",
        email="corashina@gmail.com",
        website_text="corashina.github.io",
        website_url="https://corashina.github.io",
        github_text="github.com/corashina",
        github_url="https://github.com/corashina",
        linkedin_text="linkedin.com/in/tomasz-zielinski-a97999161",
        linkedin_url="https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
    ),
    profile=(
        "Full-stack engineer with five years of commercial software delivery across "
        "business platforms, integrations, mobile applications, logistics, manufacturing, "
        "workflow automation, e-invoicing, and document AI. I work from user-facing "
        "applications and APIs through integration, delivery, and release."
    ),
    technology_groups=(
        ("Languages", ("TypeScript", "JavaScript", "C#", "Dart", "XSLT/XML")),
        ("Platforms", ("React", "Node.js", ".NET", "React Native/Expo", "Flutter")),
        ("Systems", ("REST APIs", "JWT", "n8n", "Oracle JD Edwards")),
        ("Delivery", ("GitHub Actions", "CI/CD", "npm packages", "Vite")),
    ),
    employment=Employment(
        company="Xelto",
        period="2021–2026",
        roles=(
            Role(
                title="Full-Stack Engineer",
                period="2024–2026",
                bullets=(
                    "Delivered platform applications, integrations, reusable components, mobile experiences, and operational tooling.",
                    "Built administration, system setup, workflow approval, e-invoicing, document-processing, and document-AI interfaces.",
                    "Worked across React/TypeScript, REST/JWT, React Native/Expo, Flutter, .NET/C#, XSLT/XML, and integration tooling.",
                    "Maintained delivery pipelines, configuration, versioning, CI/CD workflows, and shared-package publishing.",
                ),
            ),
            Role(
                title="Junior Frontend Developer",
                period="2021–2024",
                bullets=(
                    "Built React/JavaScript applications for warehouse and manufacturing workflows on scanners and mobile devices.",
                    "Implemented process state, validation, barcode interaction, label printing, localisation, and API-connected operational screens.",
                    "Maintained shared UI and API foundations used across commercial applications.",
                ),
            ),
        ),
    ),
    commercial_projects=(
        Project("Xelcode", "2021–2026", "React, JavaScript, Oracle JD Edwards", "Scanner-driven warehouse and manufacturing workflows with operational state, validation, printing, and ERP integration."),
        Project("Workflow", "2024–2026", "React, TypeScript, REST APIs", "Approval and business-process modules with configurable data, document handling, and operational actions."),
        Project("Document AI / ICR", "2025–2026", "React, TypeScript, PDF, JSON", "Interfaces for PDF handling, prompt configuration, document analysis, and structured results."),
        Project("e-Invoicing / KSeF", "2024–2026", "React, TypeScript, .NET, XSLT/XML", "Document and integration-rule workflows covering PDF/XML views, logs, and Polish e-invoicing processes."),
        Project("XELapps and mobile", "2024–2026", "React Native/Expo, Flutter, JWT", "Platform setup and mobile workflows for users, applications, authentication, and business-process access."),
    ),
    earlier_experience=(
        "Freelance Web Development | Poznan, Poland | May–August 2018",
        "Built responsive single-page application components and improved scalability, performance, and search visibility.",
    ),
    personal_projects=(
        Project("Endless City", "September 2018", "JavaScript, Three.js, WebGL, glTF", "Interactive infinite city scene with a custom glTF 2.0 loader.", "https://github.com/corashina/Endless-City"),
        Project("Flappy-Pixie", "October 2018", "JavaScript, Three.js, WebGL", "Flappy Bird-style game with a 3D parallax background, completed as a one-week interview challenge.", "https://github.com/corashina/Flappy-Pixie"),
        Project("Fitmed", "July 2018", "React, Redux, Node.js, Express, MongoDB", "Prototype platform for dietitians with API integration, authentication, and input validation.", "https://github.com/corashina/Fitmed"),
    ),
    education=(
        Education("University of Southampton", "BSc Computer Science", "July 2020"),
        Education("Poznan University of Technology", "Information Engineering", "2016–2017"),
    ),
    languages=("English", "Polish"),
    consent=(
        "I hereby consent to the processing of personal data in this document by anyone "
        "who receives it for the sole purpose of considering my skills and experience for "
        "professional opportunities."
    ),
)

FORBIDDEN_PUBLIC_TERMS = (
    "3,342",
    "17 private",
    "Roldrob",
    "Filtron",
    "Fakro",
    "Bakoma",
    "Walstead",
    "LSC",
    "Malow",
)
```

- [ ] **Step 4: Run the full content tests**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test -v
```

Expected: new content-model tests pass; existing one-page rendering tests may fail and are addressed in Task 2.

- [ ] **Step 5: Commit the content model and tests**

```powershell
git add -- scripts/full_stack_cv_content.py scripts/create_editable_cv_test.py
git commit -m "feat: add public-safe full-stack CV content"
```

---

### Task 2: Rebuild the editable DOCX as a two-page full-stack CV

**Files:**
- Modify: `scripts/create_editable_cv.py`
- Modify: `scripts/create_editable_cv_test.py`
- Test: `scripts/create_editable_cv_test.py`

**Interfaces:**
- Consumes: `CV_DATA: CvData` and `FORBIDDEN_PUBLIC_TERMS`
- Produces: `build_cv(output_path: Path) -> Path` with exactly one explicit page break and the approved section order

- [ ] **Step 1: Replace obsolete one-page assertions with failing two-page structure assertions**

Add:

```python
def test_builds_two_page_full_stack_docx_structure(self) -> None:
    headings = [
        paragraph.text
        for paragraph in self.document.paragraphs
        if paragraph.style.name == "Heading 1"
    ]
    self.assertEqual(
        headings,
        [
            "Profile",
            "Core Technologies",
            "Professional Experience",
            "Selected Product Work",
            "Earlier Experience",
            "Selected Projects",
            "Education",
            "Additional Information",
        ],
    )
    with ZipFile(self.output_path) as archive:
        xml = archive.read("word/document.xml")
    self.assertEqual(xml.count(b'w:type="page"'), 1)
    self.assertIn(b"Full-Stack Engineer", xml)
    self.assertNotIn(b"expected in July 2020", xml)

def test_docx_has_current_links_and_only_approved_projects(self) -> None:
    for value in (
        "corashina.github.io",
        "corashina@gmail.com",
        "+48 791 748 226",
        "github.com/corashina",
        "linkedin.com/in/tomasz-zielinski-a97999161",
        "Endless City",
        "Flappy-Pixie",
        "Fitmed",
    ):
        self.assertIn(value, self.text)
    for obsolete in ("Haskell Interpreter", "GPU Particles", "Sushi-Go"):
        self.assertNotIn(obsolete, self.text)
```

- [ ] **Step 2: Run the two new tests and confirm they fail**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test.EditableCvBuilderTest.test_builds_two_page_full_stack_docx_structure scripts.create_editable_cv_test.EditableCvBuilderTest.test_docx_has_current_links_and_only_approved_projects -v
```

Expected: FAIL because the generator still emits the reconstructed one-page 2018 CV.

- [ ] **Step 3: Refactor the DOCX helpers to consume `CV_DATA`**

At the top of `create_editable_cv.py`, import:

```python
from full_stack_cv_content import CV_DATA, CvData, Project, Role
```

Replace hard-coded identity constants with `CV_DATA.identity`. Keep:

```python
SERIF_FONT = "Times New Roman"
SANS_FONT = "Calibri"
```

Add reusable helpers:

```python
def _add_section_heading(document: Document, text: str) -> None:
    paragraph = document.add_heading(text, level=1)
    paragraph.paragraph_format.keep_with_next = True


def _add_role(document: Document, role: Role, bullet_number_id: int) -> None:
    add_title_date(document, ((role.title, True),), role.period)
    for bullet in role.bullets:
        _add_bullet(document, bullet, bullet_number_id)


def _add_project(document: Document, project: Project) -> None:
    add_title_date(
        document,
        ((project.title, True), (f"  ·  {project.tools}", True)),
        project.period,
    )
    paragraph = _add_description(document, project.description)
    if project.url:
        paragraph.add_run("  ")
        add_hyperlink(paragraph, "View project", project.url, color="555555")
```

- [ ] **Step 4: Implement the two-page DOCX body**

Use this section sequence in `build_cv`:

```python
_add_header(document, CV_DATA)

_add_section_heading(document, "Profile")
_add_description(document, CV_DATA.profile)

_add_section_heading(document, "Core Technologies")
for label, technologies in CV_DATA.technology_groups:
    _add_labeled_line(document, f"{label}:  ", ", ".join(technologies), after=3)

_add_section_heading(document, "Professional Experience")
add_title_date(
    document,
    ((CV_DATA.employment.company, True),),
    CV_DATA.employment.period,
)
for role in CV_DATA.employment.roles:
    _add_role(document, role, bullet_number_id)

document.add_page_break()

_add_section_heading(document, "Selected Product Work")
for project in CV_DATA.commercial_projects:
    _add_project(document, project)

_add_section_heading(document, "Earlier Experience")
_add_description(document, CV_DATA.earlier_experience[0])
_add_description(document, CV_DATA.earlier_experience[1])

_add_section_heading(document, "Selected Projects")
for project in CV_DATA.personal_projects:
    _add_project(document, project)

_add_section_heading(document, "Education")
for education in CV_DATA.education:
    add_title_date(
        document,
        ((education.institution, True),),
        education.period,
    )
    _add_description(document, education.qualification)

_add_section_heading(document, "Additional Information")
_add_labeled_line(document, "Languages:  ", ", ".join(CV_DATA.languages), after=3)
consent = document.add_paragraph(style="CV Footer")
consent.add_run(CV_DATA.consent)
```

Update `_add_header` to render the role under the name and the five current
contact/profile links in the right cell. Keep explicit table geometry and
clickable Word hyperlink relationships.

- [ ] **Step 5: Tune named styles for a readable two-page layout**

Use these minimum tokens:

```python
section.top_margin = Inches(0.5)
section.bottom_margin = Inches(0.45)
section.left_margin = Inches(0.55)
section.right_margin = Inches(0.55)

_set_style_font(document.styles["Normal"], SANS_FONT, 9, INK)
_set_style_font(document.styles["Heading 1"], SERIF_FONT, 16, MUTED)
_set_style_font(document.styles["CV Title"], SERIF_FONT, 28, INK)
_set_style_font(document.styles["CV Entry"], SANS_FONT, 9, INK, bold=True)
_set_style_font(document.styles["CV Description"], SANS_FONT, 9, INK)
_set_style_font(document.styles["CV Bullet"], SANS_FONT, 9, INK)
_set_style_font(document.styles["CV Footer"], SANS_FONT, 8, INK)
```

Keep heading, entry, and bullet paragraphs together with their following
content where practical. Do not reduce normal, bullet, project, role, or skill
text below 9 pt.

- [ ] **Step 6: Run all DOCX tests**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test -v
```

Expected: all DOCX structure, content, font, link, and confidentiality tests pass.

- [ ] **Step 7: Commit the DOCX implementation**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py
git commit -m "feat: build two-page full-stack CV"
```

---

### Task 3: Make the PDF renderer consume the same two-page content

**Files:**
- Modify: `scripts/create_editable_cv.py`
- Modify: `scripts/create_editable_cv_test.py`
- Test: `scripts/create_editable_cv_test.py`

**Interfaces:**
- Consumes: the same `CV_DATA` used by `build_cv`
- Produces: `build_pdf(output_path: Path) -> Path` with two US Letter pages and matching facts

- [ ] **Step 1: Add failing PDF parity assertions**

Replace the old one-page PDF test with:

```python
def test_builds_two_page_pdf_with_shared_current_content(self) -> None:
    pdf_path = Path(self._temp_dir.name) / "cv.pdf"
    build_pdf(pdf_path)
    reader = PdfReader(pdf_path)
    self.assertEqual(len(reader.pages), 2)
    self.assertTrue(
        all(
            float(page.mediabox.width) == 612
            and float(page.mediabox.height) == 792
            for page in reader.pages
        )
    )
    extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
    for expected in (
        "Full-Stack Engineer",
        "Xelto",
        "2021",
        "2026",
        "Endless City",
        "Flappy-Pixie",
        "Fitmed",
        "BSc Computer Science",
        "July 2020",
        "corashina@gmail.com",
    ):
        self.assertIn(expected, extracted)
    for forbidden in FORBIDDEN_PUBLIC_TERMS:
        self.assertNotIn(forbidden.casefold(), extracted.casefold())
```

- [ ] **Step 2: Run the PDF test and confirm it fails**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test.EditableCvBuilderTest.test_builds_two_page_pdf_with_shared_current_content -v
```

Expected: FAIL because `build_pdf` still emits the obsolete one-page CV.

- [ ] **Step 3: Implement page-aware PDF helpers**

Add:

```python
def _pdf_header(pdf: canvas.Canvas, data: CvData) -> float:
    pdf.setFillColor(black)
    pdf.setFont("Times-Roman", 28)
    pdf.drawString(40, 744, data.identity.name)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(40, 724, data.identity.role)

    contact_rows = (
        (data.identity.website_text, data.identity.website_url, 748),
        (data.identity.email, f"mailto:{data.identity.email}", 735),
        (data.identity.phone, "", 722),
        (data.identity.github_text, data.identity.github_url, 709),
        (data.identity.linkedin_text, data.identity.linkedin_url, 696),
    )
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(PDF_MUTED)
    for text, url, y in contact_rows:
        pdf.drawRightString(572, y, text)
        if url:
            width = stringWidth(text, "Helvetica", 9)
            pdf.linkURL(url, (572 - width, y - 1, 572, y + 9), relative=0)
    return 674


def _pdf_wrapped_text(
    pdf: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    font_name: str = "Helvetica",
    size: float = 9,
    leading: float = 11,
) -> float:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and stringWidth(candidate, font_name, size) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)

    pdf.setFont(font_name, size)
    pdf.setFillColor(black)
    for line in lines:
        pdf.drawString(x, y, line)
        y -= leading
    return y


def _pdf_bullet(pdf: canvas.Canvas, text: str, y: float) -> float:
    pdf.setFillColor(black)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(41, y, "•")
    next_y = _pdf_wrapped_text(
        pdf,
        text,
        x=49,
        y=y,
        width=519,
        font_name="Helvetica",
        size=9,
        leading=11,
    )
    return next_y - 3
```

Do not truncate or shrink text to force a page fit.

- [ ] **Step 4: Implement the shared two-page PDF sequence**

Page 1 must render:

```text
Header
Profile
Core Technologies
Professional Experience
```

Page 2 must render:

```text
Selected Product Work
Earlier Experience
Selected Projects
Education
Additional Information
Consent
```

Use `pdf.showPage()` exactly once between the page groups. Draw links for email,
website, GitHub, LinkedIn, and personal projects with `pdf.linkURL`.

- [ ] **Step 5: Run the complete generator suite**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test -v
```

Expected: all DOCX and PDF tests pass.

- [ ] **Step 6: Commit PDF parity**

```powershell
git add -- scripts/create_editable_cv.py scripts/create_editable_cv_test.py
git commit -m "feat: add matching two-page CV PDF"
```

---

### Task 4: Package the final CV and approved evidence sources

**Files:**
- Create: `scripts/package_full_stack_cv.py`
- Create: `scripts/package_full_stack_cv_test.py`
- Create at runtime: `output/cv-full-stack-2026/sources/source-manifest.md`
- Test: `scripts/package_full_stack_cv_test.py`

**Interfaces:**
- Consumes: final DOCX/PDF paths and the exact approved source map
- Produces: `package_cv(output_dir: Path, source_root: Path) -> Path` returning the manifest path

- [ ] **Step 1: Add a failing package test**

Create:

```python
from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from package_full_stack_cv import build_manifest, sha256_file


class PackageFullStackCvTest(unittest.TestCase):
    def test_manifest_records_original_path_hash_and_contribution(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.txt"
            source.write_text("public evidence", encoding="utf-8")
            manifest = build_manifest(
                (("source.txt", source, "Verified public evidence."),)
            )
            self.assertIn(str(source.resolve()), manifest)
            self.assertIn(sha256_file(source), manifest)
            self.assertIn("Verified public evidence.", manifest)


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

- [ ] **Step 2: Run the package test and confirm it fails**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.package_full_stack_cv_test -v
```

Expected: import failure because `package_full_stack_cv.py` does not exist.

- [ ] **Step 3: Implement deterministic evidence packaging**

Create `scripts/package_full_stack_cv.py` with:

```python
from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def build_manifest(
    sources: tuple[tuple[str, Path, str], ...],
) -> str:
    lines = [
        "# Full-Stack CV Source Manifest",
        "",
        "| Copied file | Original absolute path | SHA-256 | Contribution |",
        "| --- | --- | --- | --- |",
    ]
    for copied_name, original_path, contribution in sources:
        lines.append(
            f"| `{copied_name}` | `{original_path.resolve()}` | "
            f"`{sha256_file(original_path)}` | {contribution} |"
        )
    return "\n".join(lines) + "\n"


def package_cv(output_dir: Path, cv_docx: Path, cv_pdf: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    sources_dir = output_dir / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)

    source_map = (
        (
            "current-editable-cv.docx",
            Path(r"C:\Users\Tomasz\Documents\Projects\corashina.github.io\output\docx\tomasz_zielinski_editable.docx"),
            "Baseline reconstructed CV, early experience, education, contact details, consent, and visual reference.",
        ),
        (
            "Xelto-CV-Experience-Shareable.docx",
            Path(r"C:\Users\Tomasz\Downloads\Xelto-CV-Experience-Shareable.docx"),
            "Public-safe Xelto role progression, responsibilities, product scope, and technology coverage.",
        ),
        (
            "xelto-proof-of-work-README.md",
            Path(r"C:\Users\Tomasz\Documents\Work\XELTO\deliverables\xelto-proof-of-work\README.md"),
            "Corroborating public-safe product categories and technology coverage.",
        ),
        (
            "website-projects.ts",
            Path(r"C:\Users\Tomasz\Documents\Projects\corashina.github.io\src\data\projects.ts"),
            "Public project names, descriptions, dates, tools, and URLs.",
        ),
        (
            "website-contact.tsx",
            Path(r"C:\Users\Tomasz\Documents\Projects\corashina.github.io\src\pages\ContactPage.tsx"),
            "Public email, GitHub, LinkedIn, and portfolio links.",
        ),
    )

    shutil.copy2(cv_docx, output_dir / "Tomasz-Zielinski-Full-Stack-CV.docx")
    shutil.copy2(cv_pdf, output_dir / "Tomasz-Zielinski-Full-Stack-CV.pdf")
    for copied_name, source_path, _ in source_map:
        shutil.copy2(source_path, sources_dir / copied_name)

    manifest = sources_dir / "source-manifest.md"
    manifest.write_text(build_manifest(source_map), encoding="utf-8")
    return manifest
```

Add a CLI that accepts `--docx`, `--pdf`, and `--output-dir`, resolves every
input, refuses missing files, and calls `package_cv`.

- [ ] **Step 4: Run packaging tests**

Run:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.package_full_stack_cv_test -v
```

Expected: PASS.

- [ ] **Step 5: Commit the packager**

```powershell
git add -- scripts/package_full_stack_cv.py scripts/package_full_stack_cv_test.py
git commit -m "feat: package CV evidence sources"
```

---

### Task 5: Generate, render, audit, and deliver the evidence folder

**Files:**
- Create: `output/cv-full-stack-2026/Tomasz-Zielinski-Full-Stack-CV.docx`
- Create: `output/cv-full-stack-2026/Tomasz-Zielinski-Full-Stack-CV.pdf`
- Create: `output/cv-full-stack-2026/sources/*`
- Verify: `scripts/create_editable_cv.py`
- Verify: `scripts/package_full_stack_cv.py`

**Interfaces:**
- Consumes: completed generator, content model, and packager
- Produces: the final self-contained CV folder and verification evidence

- [ ] **Step 1: Run all Python tests**

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest scripts.create_editable_cv_test scripts.package_full_stack_cv_test -v
```

Expected: all tests pass.

- [ ] **Step 2: Generate staging DOCX and PDF**

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\create_editable_cv.py tmp\Tomasz-Zielinski-Full-Stack-CV.docx
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\create_editable_cv.py tmp\Tomasz-Zielinski-Full-Stack-CV.pdf --pdf
```

Expected: both files exist and are non-empty.

- [ ] **Step 3: Package the deliverables and sources**

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts\package_full_stack_cv.py --docx tmp\Tomasz-Zielinski-Full-Stack-CV.docx --pdf tmp\Tomasz-Zielinski-Full-Stack-CV.pdf --output-dir output\cv-full-stack-2026
```

Expected: final DOCX, PDF, five approved copied sources, and the manifest exist.

- [ ] **Step 4: Render the final DOCX**

First attempt the canonical document renderer:

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\Tomasz\.codex\plugins\cache\openai-primary-runtime\documents\26.715.12143\skills\documents\render_docx.py' output\cv-full-stack-2026\Tomasz-Zielinski-Full-Stack-CV.docx --output_dir tmp\full-stack-cv-render --emit_pdf
```

If LibreOffice is unavailable, use the already-installed temporary
Aspose.Words diagnostic renderer to produce a QA-only PDF, then Poppler to
produce `page-1.png` and `page-2.png`. Keep the evaluation watermark only in
`tmp`; confirm the delivered DOCX package contains no Aspose or evaluation
strings.

- [ ] **Step 5: Inspect both rendered pages at 100% zoom**

Confirm:

- Exactly two pages.
- No clipped, overlapping, or missing text.
- Page 1 ends after professional experience.
- Page 2 begins with selected product work.
- No isolated headings or awkward breaks.
- Contact details fit and links remain readable.
- Body text is at least 9 pt.
- Consent remains unobtrusive at the bottom of page 2.

If any check fails, adjust styles or spacing, regenerate, rerender, and repeat.

- [ ] **Step 6: Run structural and accessibility audits**

```powershell
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\Tomasz\.codex\plugins\cache\openai-primary-runtime\documents\26.715.12143\skills\documents\scripts\a11y_audit.py' output\cv-full-stack-2026\Tomasz-Zielinski-Full-Stack-CV.docx
& 'C:\Users\Tomasz\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' 'C:\Users\Tomasz\.codex\plugins\cache\openai-primary-runtime\documents\26.715.12143\skills\documents\scripts\table_geometry.py' output\cv-full-stack-2026\Tomasz-Zielinski-Full-Stack-CV.docx
```

Resolve material findings. A generic missing-header-row warning is acceptable
only for the borderless identity/contact layout table and must be documented as
a non-data-table false positive.

- [ ] **Step 7: Verify PDF/DOCX parity and confidentiality**

Use Python to extract both files and assert:

```python
required = (
    "Full-Stack Engineer",
    "Xelto",
    "2021",
    "2026",
    "Endless City",
    "Flappy-Pixie",
    "Fitmed",
    "BSc Computer Science",
    "July 2020",
)
for value in required:
    assert value in docx_text
    assert value in pdf_text
for forbidden in FORBIDDEN_PUBLIC_TERMS:
    assert forbidden.casefold() not in docx_text.casefold()
    assert forbidden.casefold() not in pdf_text.casefold()
```

Also scan the final DOCX OOXML package for `Aspose`, `Evaluation`, obsolete
student wording, old contact details, client names, and private metrics.

- [ ] **Step 8: Verify source hashes and original preservation**

Recompute every source SHA-256 and compare it with
`sources/source-manifest.md`. Confirm the original reconstructed PDF hash
remains:

```text
901A5FB1190D968C6A216ECBF478AEF23FB66B4BD6BA6755EAAD1680D51D7D51
```

- [ ] **Step 9: Run final repository checks**

```powershell
git diff --check -- scripts/full_stack_cv_content.py scripts/create_editable_cv.py scripts/create_editable_cv_test.py scripts/package_full_stack_cv.py scripts/package_full_stack_cv_test.py
git status --short
```

Expected: no whitespace errors; only intentional source changes and untracked
deliverables appear.

- [ ] **Step 10: Report the final folder**

Return one clickable link to:

```text
output/cv-full-stack-2026
```

Mention that the DOCX and PDF are two pages, the DOCX passed visual QA, the
evidence manifest is included, and private metrics/client names were excluded.
