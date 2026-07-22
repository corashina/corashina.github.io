from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

from docx import Document
from docx.shared import Inches, Pt

sys.path.insert(0, str(Path(__file__).resolve().parent))

from create_editable_cv import build_cv


class EditableCvBuilderTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._temp_dir = tempfile.TemporaryDirectory()
        cls.output_path = Path(cls._temp_dir.name) / "cv.docx"
        build_cv(cls.output_path)
        cls.document = Document(cls.output_path)
        cls.text = "\n".join(paragraph.text for paragraph in cls.document.paragraphs)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._temp_dir.cleanup()

    def test_builds_letter_document_with_compact_explicit_margins(self) -> None:
        section = self.document.sections[0]

        self.assertEqual(section.page_width, Inches(8.5))
        self.assertEqual(section.page_height, Inches(11))
        self.assertAlmostEqual(section.top_margin, Inches(0.52), delta=Pt(0.1))
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
            "www.zielin.ski",
            "contact@zielin.ski",
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
        self.assertNotIn(b"<w:tbl", document_xml)
        self.assertNotIn(b"<w:txbxContent", document_xml)
        self.assertIn(b"relationships/hyperlink", relationships_xml)

    def test_has_no_placeholders_or_extraction_artifacts(self) -> None:
        for forbidden in ("TBD", "TODO", "\u200b", "\ufffd"):
            self.assertNotIn(forbidden, self.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
