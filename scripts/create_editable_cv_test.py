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

    def test_builds_letter_document_with_compact_explicit_margins(self) -> None:
        section = self.document.sections[0]

        self.assertEqual(section.page_width, Inches(8.5))
        self.assertEqual(section.page_height, Inches(11))
        self.assertAlmostEqual(section.top_margin, Inches(0.398), delta=Pt(0.1))
        self.assertAlmostEqual(section.bottom_margin, Inches(0.42), delta=Pt(0.1))
        self.assertAlmostEqual(section.left_margin, Inches(0.5), delta=Pt(0.1))
        self.assertAlmostEqual(section.right_margin, Inches(0.5), delta=Pt(0.1))

    def test_preserves_section_order_and_visible_content(self) -> None:
        headings = [
            paragraph.text
            for paragraph in self.document.paragraphs
            if paragraph.style.name == "Heading 1"
        ]

        self.assertEqual(
            headings,
            [
                "Professional Experience",
                "Education",
                "Projects",
                "Technical Skills",
            ],
        )

        expected_fragments = [
            "Tomasz Zielinski",
            "corashina.github.io",
            "corashina@gmail.com",
            "+48 791 748 226",
            "Freelance Web Development",
            "University of Southampton",
            "Haskell Interpreter",
            "GPU Particles",
            "Flappy-Pixie",
            "Endless-City",
            "Sushi-Go",
            "Fitmed",
            "Programming:",
            "Software:",
            "Languages:",
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
            "CV Contact": ("Calibri", 10.0),
            "CV Entry": ("Calibri", 9.0),
            "CV Description": ("Calibri", 9.0),
            "CV Bullet": ("Calibri", 9.0),
            "CV Skill": ("Calibri", 9.0),
            "CV Footer": ("Calibri", 9.0),
        }

        for style_name, (font_name, font_size) in expected_styles.items():
            style = self.document.styles[style_name]
            self.assertEqual(style.font.name, font_name)
            self.assertAlmostEqual(style.font.size.pt, font_size, delta=0.01)

    def test_uses_measured_vertical_spacing_from_the_source(self) -> None:
        projects = next(
            paragraph
            for paragraph in self.document.paragraphs
            if paragraph.text == "Projects"
        )
        technical = next(
            paragraph
            for paragraph in self.document.paragraphs
            if paragraph.text == "Technical Skills"
        )
        project_descriptions = [
            paragraph
            for paragraph in self.document.paragraphs
            if paragraph.style.name == "CV Description"
            and paragraph.text.startswith(
                (
                    "Language and interpreter",
                    "WebGL particle",
                    "Flappy Bird",
                    "Interactive infinite",
                    "Multithreaded business",
                )
            )
        ]
        skill_lines = [
            paragraph
            for paragraph in self.document.paragraphs
            if paragraph.style.name == "CV Skill"
        ]

        self.assertAlmostEqual(projects.paragraph_format.space_after, Pt(17.8), delta=Pt(0.1))
        self.assertAlmostEqual(technical.paragraph_format.space_after, Pt(11.8), delta=Pt(0.1))
        self.assertEqual(len(project_descriptions), 5)
        self.assertTrue(
            all(
                abs(paragraph.paragraph_format.space_after - Pt(14)) <= Pt(0.1)
                for paragraph in project_descriptions
            )
        )
        self.assertEqual(len(skill_lines), 3)
        self.assertEqual(
            [round(paragraph.paragraph_format.space_after.pt, 1) for paragraph in skill_lines],
            [10.7, 10.0, 10.3],
        )

    def test_has_no_placeholders_or_extraction_artifacts(self) -> None:
        for forbidden in ("TBD", "TODO", "\u200b", "\ufffd"):
            self.assertNotIn(forbidden, self.text)

    def test_builds_one_page_letter_pdf_with_source_content(self) -> None:
        pdf_path = Path(self._temp_dir.name) / "cv.pdf"
        build_pdf(pdf_path)

        reader = PdfReader(pdf_path)
        self.assertEqual(len(reader.pages), 1)
        page = reader.pages[0]
        self.assertEqual(float(page.mediabox.width), 612)
        self.assertEqual(float(page.mediabox.height), 792)
        extracted = page.extract_text()
        self.assertIn("Tomasz Zielinski", extracted)
        self.assertIn("Professional Experience", extracted)
        self.assertIn("I hereby consent", extracted)
        self.assertIn("corashina.github.io", extracted)
        self.assertIn("corashina@gmail.com", extracted)
        self.assertIn("+48 791 748 226", extracted)
        self.assertNotIn("contact@zielin.ski", extracted)


if __name__ == "__main__":
    unittest.main(verbosity=2)
