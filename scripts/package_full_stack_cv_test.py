from __future__ import annotations

import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.full_stack_cv_content import FORBIDDEN_PUBLIC_TERMS
from scripts.package_full_stack_cv import package_bundle, sha256_file


class FullStackCvPackagerTest(unittest.TestCase):
    def test_cli_can_be_invoked_by_script_path(self) -> None:
        script = Path(__file__).with_name("package_full_stack_cv.py")

        completed = subprocess.run(
            [sys.executable, str(script), "--help"],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("--output-dir", completed.stdout)

    def test_sha256_file_matches_known_digest(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            source = Path(temporary_directory) / "source.txt"
            source.write_bytes(b"public evidence")

            self.assertEqual(
                sha256_file(source),
                hashlib.sha256(b"public evidence").hexdigest(),
            )

    def test_packages_shareable_sources_and_references_private_evidence_by_hash(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            generated_docx = root / "generated.docx"
            generated_pdf = root / "generated.pdf"
            baseline_docx = root / "baseline.docx"
            website_projects = root / "projects.ts"
            website_contact = root / "ContactPage.tsx"
            private_xelto_docx = root / "private-xelto.docx"
            private_proof = root / "README.md"
            output_directory = root / "bundle"

            generated_docx.write_bytes(b"new docx")
            generated_pdf.write_bytes(b"new pdf")
            baseline_docx.write_bytes(b"baseline docx")
            website_projects.write_text("Endless City\nFlappy-Pixie\nFitmed", encoding="utf-8")
            website_contact.write_text("corashina@gmail.com", encoding="utf-8")
            private_xelto_docx.write_bytes(b"private source")
            private_proof.write_text("private proof", encoding="utf-8")

            package_bundle(
                generated_docx=generated_docx,
                generated_pdf=generated_pdf,
                output_directory=output_directory,
                baseline_docx=baseline_docx,
                website_projects=website_projects,
                website_contact=website_contact,
                private_sources=(private_xelto_docx, private_proof),
            )

            expected_files = {
                "Tomasz-Zielinski-Full-Stack-CV.docx",
                "Tomasz-Zielinski-Full-Stack-CV.pdf",
                "sources/current-editable-cv.docx",
                "sources/xelto-public-evidence.md",
                "sources/website-projects.ts",
                "sources/website-contact.tsx",
                "sources/source-manifest.md",
            }
            actual_files = {
                path.relative_to(output_directory).as_posix()
                for path in output_directory.rglob("*")
                if path.is_file()
            }
            self.assertEqual(actual_files, expected_files)
            self.assertNotIn(private_xelto_docx.name, {path.name for path in output_directory.rglob("*")})
            self.assertNotIn(private_proof.name, {path.name for path in output_directory.rglob("*")})

            manifest = (output_directory / "sources" / "source-manifest.md").read_text(
                encoding="utf-8"
            )
            self.assertIn("not copied", manifest)
            self.assertIn(str(private_xelto_docx), manifest)
            self.assertIn(sha256_file(private_xelto_docx), manifest)
            self.assertIn(str(private_proof), manifest)
            self.assertIn(sha256_file(private_proof), manifest)

            public_evidence = (
                output_directory / "sources" / "xelto-public-evidence.md"
            ).read_text(encoding="utf-8")
            self.assertIn("Full-Stack Developer", public_evidence)
            self.assertIn("Junior Frontend Developer", public_evidence)
            self.assertIn("2021", public_evidence)
            for forbidden_term in FORBIDDEN_PUBLIC_TERMS:
                self.assertNotIn(forbidden_term.casefold(), public_evidence.casefold())


if __name__ == "__main__":
    unittest.main()
