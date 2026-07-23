from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.shared import Inches, Pt
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))

from create_editable_cv import build_cv, build_pdf
from full_stack_cv_content import CV_DATA, FORBIDDEN_PUBLIC_TERMS


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

    def test_builds_letter_document_with_readable_two_page_margins(self) -> None:
        section = self.document.sections[0]

        self.assertEqual(section.page_width, Inches(8.5))
        self.assertEqual(section.page_height, Inches(11))
        self.assertAlmostEqual(section.top_margin, Inches(0.5), delta=Pt(0.1))
        self.assertAlmostEqual(section.bottom_margin, Inches(0.45), delta=Pt(0.1))
        self.assertAlmostEqual(section.left_margin, Inches(0.55), delta=Pt(0.1))
        self.assertAlmostEqual(section.right_margin, Inches(0.55), delta=Pt(0.1))

    def test_preserves_section_order_and_visible_content(self) -> None:
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

        expected_fragments = [
            "Tomasz Zielinski",
            "Full-Stack Engineer",
            "corashina.github.io",
            "corashina@gmail.com",
            "+48 791 748 226",
            "github.com/corashina",
            "linkedin.com/in/tomasz-zielinski-a97999161",
            "Profile",
            "Xelto",
            "Selected Product Work",
            "Earlier Experience",
            "Freelance Web Development",
            "Selected Projects",
            "Endless City",
            "Flappy-Pixie",
            "Fitmed",
            "Education",
            "University of Southampton",
            "July 2020",
            "Additional Information",
            "I hereby consent to the processing of personal data",
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
            "CV Entry",
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

    def test_matches_the_source_pdf_font_roles(self) -> None:
        expected_styles = {
            "CV Title": ("Times New Roman", 28.0),
            "Heading 1": ("Times New Roman", 16.0),
            "CV Contact": ("Calibri", 9.0),
            "CV Role": ("Calibri", 11.0),
            "CV Entry": ("Calibri", 9.0),
            "CV Description": ("Calibri", 9.0),
            "CV Bullet": ("Calibri", 9.0),
            "CV Skill": ("Calibri", 9.0),
            "CV Footer": ("Calibri", 8.0),
        }

        for style_name, (font_name, font_size) in expected_styles.items():
            style = self.document.styles[style_name]
            self.assertEqual(style.font.name, font_name)
            self.assertAlmostEqual(style.font.size.pt, font_size, delta=0.01)

    def test_uses_readable_body_fonts_and_keep_rules(self) -> None:
        for style_name in ("CV Entry", "CV Description", "CV Bullet", "CV Skill"):
            style = self.document.styles[style_name]
            self.assertGreaterEqual(style.font.size.pt, 9)
        for paragraph in self.document.paragraphs:
            if paragraph.style.name == "Heading 1":
                self.assertTrue(paragraph.paragraph_format.keep_with_next)

    def test_has_no_placeholders_or_extraction_artifacts(self) -> None:
        for forbidden in ("TBD", "TODO", "\u200b", "\ufffd"):
            self.assertNotIn(forbidden, self.text)

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
            document_xml = archive.read("word/document.xml")
        self.assertEqual(document_xml.count(b'w:type="page"'), 1)
        self.assertIn(b"Full-Stack Engineer", document_xml)
        self.assertNotIn(b"expected in July 2020", document_xml)

    def test_page_break_balances_complete_sections_between_pages(self) -> None:
        break_indices = [
            index
            for index, paragraph in enumerate(self.document.paragraphs)
            if paragraph._p.xpath(".//w:br[@w:type='page']")
        ]
        self.assertEqual(len(break_indices), 1)

        paragraph_positions = {
            paragraph.text: index
            for index, paragraph in enumerate(self.document.paragraphs)
        }
        break_index = break_indices[0]
        self.assertLess(paragraph_positions["Selected Product Work"], break_index)
        self.assertGreater(paragraph_positions["Earlier Experience"], break_index)

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
            "Tomasz Zielinski",
            "Full-Stack Engineer",
            "Professional Experience",
            "Xelto",
            "2021",
            "2026",
            "Endless City",
            "Flappy-Pixie",
            "Fitmed",
            "BSc Computer Science",
            "July 2020",
            "corashina@gmail.com",
            "I hereby consent",
        ):
            self.assertIn(expected, extracted)
        for forbidden in FORBIDDEN_PUBLIC_TERMS:
            self.assertNotIn(forbidden.casefold(), extracted.casefold())


if __name__ == "__main__":
    unittest.main(verbosity=2)
