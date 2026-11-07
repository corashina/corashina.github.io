from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

from docx import Document
from docx.oxml.ns import qn
from docx.shared import Mm, Pt
import pdfplumber
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))

from create_editable_cv import build_cv, build_pdf, contact_rows
from full_stack_cv_content import CV_DATA, FORBIDDEN_PUBLIC_TERMS


EXPECTED_HEADINGS = [
    "Profile",
    "Professional Experience",
    "Technologies",
    "Projects",
    "Education",
    "Additional Information",
]
PROJECT_TITLES = ["MIBSI Cluster Bridge", "The Long Drive", "Don't Sleep With The Fishes"]


class EditableCvBuilderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temp_dir = tempfile.TemporaryDirectory()
        cls.output_path = Path(cls._temp_dir.name) / "cv.docx"
        build_cv(cls.output_path)
        cls.document = Document(cls.output_path)
        body_text = [paragraph.text for paragraph in cls.document.paragraphs]
        table_text = [
            paragraph.text
            for table in cls.document.tables
            for row in table.rows
            for cell in row.cells
            for paragraph in cell.paragraphs
        ]
        cls.text = "\n".join(table_text + body_text)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temp_dir.cleanup()

    def test_profile_contains_the_approved_ownership_sentence(self) -> None:
        self.assertIn(
            "I translate operational requirements into maintainable systems and "
            "take ownership across the delivery lifecycle.",
            CV_DATA.profile,
        )

    def test_builds_a4_document_with_compact_one_page_margins(self) -> None:
        section = self.document.sections[0]

        self.assertAlmostEqual(section.page_width, Mm(210), delta=Pt(0.1))
        self.assertAlmostEqual(section.page_height, Mm(297), delta=Pt(0.1))
        self.assertAlmostEqual(section.top_margin, Mm(11), delta=Pt(0.1))
        self.assertAlmostEqual(section.bottom_margin, Mm(10), delta=Pt(0.1))
        self.assertAlmostEqual(section.left_margin, Mm(12.7), delta=Pt(0.1))
        self.assertAlmostEqual(section.right_margin, Mm(12.7), delta=Pt(0.1))

    def test_preserves_section_order_and_visible_content(self) -> None:
        headings = [
            paragraph.text
            for paragraph in self.document.paragraphs
            if paragraph.style.name == "Heading 1"
        ]

        self.assertEqual(
            headings,
            EXPECTED_HEADINGS,
        )

        expected_fragments = [
            "Tomasz Zielinski",
            "Full-Stack Developer",
            "corashina.github.io",
            "corashina@gmail.com",
            "+48 791 748 226",
            "Profile",
            "Professional Experience",
            "Xelto",
            "Workflow",
            "Xelcode",
            "Freelance Web Development",
            "Technologies",
            "Projects",
            *PROJECT_TITLES,
            "Education",
            "University of Southampton",
            "2017–2020",
            "Additional Information",
            "Polish (native)",
            "Regulation (EU) 2016/679",
        ]

        positions = [self.text.index(fragment) for fragment in expected_fragments]
        self.assertEqual(positions, sorted(positions))

        for obsolete_contact in (
            "www.zielin.ski",
            "contact@zielin.ski",
            "07519554924",
        ):
            self.assertNotIn(obsolete_contact, self.text)

    def test_uses_named_styles_and_editable_word_structures(self) -> None:
        required_styles = {
            "CV Title",
            "CV Role",
            "CV Entry Title",
            "CV Position",
            "CV Meta",
            "CV Description",
            "CV Bullet",
            "CV Footer",
        }
        style_names = {style.name for style in self.document.styles}
        self.assertTrue(required_styles.issubset(style_names))

        with ZipFile(self.output_path) as archive:
            document_xml = archive.read("word/document.xml")
            relationships_xml = archive.read("word/_rels/document.xml.rels")

        self.assertIn(b'w:val="right"', document_xml)
        self.assertIn(b"<w:numPr>", document_xml)
        self.assertIn(b"<w:hyperlink", document_xml)
        self.assertEqual(len(self.document.tables), 1)
        self.assertEqual(len(self.document.tables[0].rows), 1)
        self.assertEqual(len(self.document.tables[0].columns), 2)
        self.assertNotIn(b"<w:txbxContent", document_xml)
        self.assertIn(b"relationships/hyperlink", relationships_xml)

    def test_uses_compact_one_page_font_roles(self) -> None:
        expected_styles = {
            "CV Title": ("Times New Roman", 26.0),
            "Heading 1": ("Calibri", 11.0),
            "CV Contact": ("Calibri", 9.0),
            "CV Role": ("Calibri", 11.0),
            "CV Entry Title": ("Calibri", 10.5),
            "CV Position": ("Calibri", 9.5),
            "CV Meta": ("Calibri", 9.0),
            "CV Description": ("Calibri", 9.0),
            "CV Bullet": ("Calibri", 9.0),
            "CV Skill": ("Calibri", 9.0),
            "CV Footer": ("Calibri", 9.0),
        }

        for style_name, (font_name, font_size) in expected_styles.items():
            style = self.document.styles[style_name]
            self.assertEqual(style.font.name, font_name)
            self.assertAlmostEqual(style.font.size.pt, font_size, delta=0.01)

    def test_uses_compact_body_fonts_and_keep_rules(self) -> None:
        for style_name in ("CV Description", "CV Bullet", "CV Skill", "CV Footer"):
            style = self.document.styles[style_name]
            self.assertAlmostEqual(style.font.size.pt, 9, delta=0.01)
        heading_style = self.document.styles["Heading 1"]
        # Headings belong to the section below them, so they need more space
        # above than below.
        self.assertGreater(
            heading_style.paragraph_format.space_before.pt,
            2 * heading_style.paragraph_format.space_after.pt,
        )
        for paragraph in self.document.paragraphs:
            if paragraph.style.name == "Heading 1":
                self.assertTrue(paragraph.paragraph_format.keep_with_next)

    def test_has_no_placeholders_or_extraction_artifacts(self) -> None:
        for forbidden in ("TBD", "TODO", "\u200b", "\ufffd"):
            self.assertNotIn(forbidden, self.text)

    def test_full_stack_content_model_contains_approved_current_facts(self) -> None:
        self.assertEqual(CV_DATA.identity.role, "Full-Stack Developer")
        self.assertEqual(CV_DATA.identity.phone, "+48 791 748 226")
        self.assertEqual(CV_DATA.identity.email, "corashina@gmail.com")
        self.assertEqual(CV_DATA.identity.website_text, "corashina.github.io")
        self.assertEqual(CV_DATA.identity.website_url, "https://corashina.github.io")
        self.assertEqual(CV_DATA.employment.period, "2020–2026")
        self.assertIn("six years", CV_DATA.profile)
        self.assertEqual(
            [(role.title, role.period) for role in CV_DATA.employment.roles],
            [
                ("Full-Stack Developer", "2024–2026"),
                ("Junior Frontend Developer", "2020–2024"),
            ],
        )
        self.assertEqual(
            [project.title for project in CV_DATA.commercial_projects],
            ["Workflow", "e-Invoicing / KSeF", "Document AI / ICR", "XELapps and mobile", "Xelcode"],
        )
        self.assertEqual(
            [project.title for project in CV_DATA.personal_projects],
            PROJECT_TITLES,
        )
        for project in CV_DATA.personal_projects:
            self.assertTrue(project.url.startswith("https://github.com/corashina/"))
            self.assertIn(project.url_text, project.url)
        self.assertEqual(CV_DATA.education[0].period, "2017–2020")

    def test_public_content_excludes_private_metrics_and_client_names(self) -> None:
        visible = CV_DATA.visible_text()
        for forbidden in FORBIDDEN_PUBLIC_TERMS:
            self.assertNotIn(forbidden.casefold(), visible.casefold())

    def test_docx_links_contact_rows_and_projects(self) -> None:
        with ZipFile(self.output_path) as archive:
            document_xml = archive.read("word/document.xml")
            relationships_xml = archive.read("word/_rels/document.xml.rels")

        self.assertEqual(document_xml.count(b'w:type="page"'), 0)
        relationships = ElementTree.fromstring(relationships_xml)
        external_targets = {
            relationship.attrib["Target"]
            for relationship in relationships
            if relationship.attrib.get("TargetMode") == "External"
        }
        self.assertEqual(
            external_targets,
            {url for _, url in contact_rows(CV_DATA)}
            | {project.url for project in CV_DATA.personal_projects},
        )

    def test_docx_distinguishes_company_from_role(self) -> None:
        company_paragraph = next(
            paragraph for paragraph in self.document.paragraphs
            if paragraph.text.startswith("Xelto")
        )
        role_paragraph = next(
            paragraph for paragraph in self.document.paragraphs
            if paragraph.text.startswith("Full-Stack Developer")
        )
        self.assertEqual(company_paragraph.style.name, "CV Entry Title")
        self.assertEqual(role_paragraph.style.name, "CV Position")
        self.assertNotEqual(
            company_paragraph.style.font.color.rgb,
            role_paragraph.style.font.color.rgb,
        )
        self.assertGreater(
            company_paragraph.style.font.size.pt,
            role_paragraph.style.font.size.pt,
        )

    def test_section_headings_are_bold_caps_with_a_rule(self) -> None:
        heading = self.document.styles["Heading 1"]
        self.assertTrue(heading.font.bold)
        self.assertTrue(heading.font.all_caps)
        self.assertIsNotNone(heading.element.pPr.find(qn("w:pBdr")))
        self.assertNotIn("Selected Projects", self.text)

    def test_heading_levels_get_lighter_as_they_get_smaller(self) -> None:
        def lightness(style_name: str) -> int:
            return sum(self.document.styles[style_name].font.color.rgb)

        levels = ["Heading 1", "CV Entry Title", "CV Position", "CV Meta"]
        self.assertEqual(
            [lightness(name) for name in levels],
            sorted(lightness(name) for name in levels),
        )
        self.assertEqual(len({lightness(name) for name in levels}), len(levels))
        self.assertLessEqual(lightness("Heading 1"), 3 * 0x11)

    def test_docx_separates_project_titles_from_technology_lines(self) -> None:
        paragraphs = self.document.paragraphs
        for title in PROJECT_TITLES:
            index = next(
                index for index, paragraph in enumerate(paragraphs)
                if paragraph.text.startswith(title)
            )
            title_style = paragraphs[index].style
            meta_style = paragraphs[index + 1].style
            self.assertEqual(title_style.name, "CV Entry Title")
            self.assertEqual(meta_style.name, "CV Meta")
            self.assertTrue(title_style.font.bold)
            self.assertFalse(meta_style.font.bold)
            self.assertGreater(title_style.font.size.pt, meta_style.font.size.pt)
            self.assertNotEqual(title_style.font.color.rgb, meta_style.font.color.rgb)

    def test_freelance_work_is_inside_professional_experience(self) -> None:
        texts = [paragraph.text for paragraph in self.document.paragraphs]
        professional = texts.index("Professional Experience")
        technologies = texts.index("Technologies")
        freelance = next(
            index for index, text in enumerate(texts)
            if text.startswith("Freelance Web Development")
        )
        self.assertLess(professional, freelance)
        self.assertLess(freelance, technologies)
        self.assertNotIn("Commercial Experience", texts)
        self.assertNotIn("Earlier Experience", texts)

    def test_builds_one_page_full_stack_docx_structure(self) -> None:
        headings = [
            paragraph.text
            for paragraph in self.document.paragraphs
            if paragraph.style.name == "Heading 1"
        ]
        self.assertEqual(
            headings,
            EXPECTED_HEADINGS,
        )
        with ZipFile(self.output_path) as archive:
            document_xml = archive.read("word/document.xml")
        self.assertEqual(document_xml.count(b'w:type="page"'), 0)
        self.assertIn(b"Full-Stack Developer", document_xml)
        self.assertNotIn(b"Full-Stack Engineer", document_xml)
        self.assertNotIn(b"expected in July 2020", document_xml)

    def test_docx_has_only_approved_contact_rows_and_projects(self) -> None:
        rows = tuple(
            self.document.tables[0].rows[0].cells[1].paragraphs[0].text.splitlines()
        )
        self.assertEqual(
            rows,
            ("corashina.github.io", "corashina@gmail.com", "+48 791 748 226"),
        )
        for value in PROJECT_TITLES:
            self.assertIn(value, self.text)
        for obsolete in (
            "tomasz-zielinski.com",
            "linkedin.com/in/",
            "Endless City",
            "Flappy-Pixie",
            "Fitmed",
            "Haskell Interpreter",
            "GPU Particles",
            "Sushi-Go",
        ):
            self.assertNotIn(obsolete, self.text)

    def test_builds_one_page_a4_pdf_with_approved_hierarchy_and_links(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "cv.pdf"
            build_pdf(output)
            reader = PdfReader(output)
            self.assertEqual(len(reader.pages), 1)
            page = reader.pages[0]
            self.assertAlmostEqual(float(page.mediabox.width), 595.28, delta=0.1)
            self.assertAlmostEqual(float(page.mediabox.height), 841.89, delta=0.1)
            text = page.extract_text() or ""
            for heading in EXPECTED_HEADINGS:
                self.assertIn(heading.upper(), text)
            self.assertNotIn("SELECTED PROJECTS", text)
            for removed in (
                "Commercial Experience",
                "Core Technologies",
                "Selected Product Work",
                "Earlier Experience",
                "tomasz-zielinski.com",
                "linkedin.com/in/",
                "View project",
            ):
                self.assertNotIn(removed, text)

            annotations = page.get("/Annots", [])
            uris = {
                annotation.get_object().get("/A", {}).get("/URI", "")
                for annotation in annotations
            }
            self.assertEqual(
                uris,
                {url for _, url in contact_rows(CV_DATA)}
                | {project.url for project in CV_DATA.personal_projects},
            )
            for forbidden in FORBIDDEN_PUBLIC_TERMS:
                self.assertNotIn(forbidden.casefold(), text.casefold())

            with pdfplumber.open(output) as pdf:
                rendered_page = pdf.pages[0]
                words = rendered_page.extract_words(extra_attrs=["fontname", "size"])
            self.assertTrue(words)
            bottom_gap = rendered_page.height - max(word["bottom"] for word in words)
            self.assertGreaterEqual(bottom_gap, 36)
            self.assertLessEqual(bottom_gap, 90)

            lines: dict[float, list[dict]] = {}
            for word in words:
                lines.setdefault(round(word["top"], 1), []).append(word)
            ordered = sorted(lines.items())
            line_texts = [" ".join(word["text"] for word in line) for _, line in ordered]

            # Each section heading sits closer to its own content than to the
            # section above it.
            for heading in EXPECTED_HEADINGS[1:]:
                index = line_texts.index(heading.upper())
                previous_bottom = max(word["bottom"] for word in ordered[index - 1][1])
                heading_top = min(word["top"] for word in ordered[index][1])
                heading_bottom = max(word["bottom"] for word in ordered[index][1])
                next_top = min(word["top"] for word in ordered[index + 1][1])
                self.assertGreater(
                    heading_top - previous_bottom,
                    1.5 * (next_top - heading_bottom),
                    heading,
                )

            # Project titles are larger and bolder than their technology lines.
            for title in PROJECT_TITLES:
                index = next(
                    index for index, line in enumerate(line_texts) if line.startswith(title)
                )
                title_word = ordered[index][1][0]
                meta_word = ordered[index + 1][1][0]
                self.assertIn("Bold", title_word["fontname"])
                self.assertNotIn("Bold", meta_word["fontname"])
                self.assertGreater(title_word["size"], meta_word["size"])

        fonts = set()
        for resource in page["/Resources"]["/Font"].values():
            font = resource.get_object()
            descriptor = font.get("/FontDescriptor")
            if descriptor is None:
                descendants = font.get("/DescendantFonts")
                descriptor = descendants[0].get_object()["/FontDescriptor"] if descendants else None
            self.assertIsNotNone(descriptor, font.get("/BaseFont"))
            descriptor = descriptor.get_object()
            self.assertTrue(
                any(key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")),
                font.get("/BaseFont"),
            )
            fonts.add(str(font.get("/BaseFont")))
        self.assertFalse(any("Helvetica" in name for name in fonts))

if __name__ == "__main__":
    unittest.main(verbosity=2)
