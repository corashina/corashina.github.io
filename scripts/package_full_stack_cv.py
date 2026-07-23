from __future__ import annotations

import argparse
import hashlib
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from scripts.full_stack_cv_content import CV_DATA, CvData


@dataclass(frozen=True)
class ManifestEntry:
    status: str
    source: str
    sha256: str
    contribution: str


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_public_evidence(data: CvData = CV_DATA) -> str:
    lines = [
        "# Xelto public evidence",
        "",
        "This file records only the public-safe facts used to refresh the CV. "
        "The underlying internal evidence remains outside this bundle.",
        "",
        f"- Employer: {data.employment.company}",
        f"- Employment period: {data.employment.period}",
        "- Commercial experience: five years",
        "",
        "## Role progression",
        "",
    ]
    for role in data.employment.roles:
        lines.append(f"### {role.title} | {role.period}")
        lines.append("")
        lines.extend(f"- {bullet}" for bullet in role.bullets)
        lines.append("")

    lines.extend(("## Public-safe product areas", ""))
    for project in data.commercial_projects:
        lines.extend(
            (
                f"### {project.title} | {project.period}",
                "",
                f"- Technologies: {project.tools}",
                f"- Contribution: {project.description}",
                "",
            )
        )
    return "\n".join(lines).rstrip() + "\n"


def build_manifest(entries: Iterable[ManifestEntry]) -> str:
    lines = [
        "# Source manifest",
        "",
        "This bundle contains only material suitable for sharing. Internal Xelto "
        "evidence is identified by path and SHA-256 digest but is not copied.",
        "",
        "| Status | Original source | SHA-256 | Contribution |",
        "| --- | --- | --- | --- |",
    ]
    for entry in entries:
        lines.append(
            f"| {entry.status} | {entry.source} | `{entry.sha256}` | "
            f"{entry.contribution} |"
        )
    return "\n".join(lines) + "\n"


def _copy_with_manifest(
    source: Path,
    destination: Path,
    contribution: str,
) -> ManifestEntry:
    source = Path(source).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return ManifestEntry("copied", str(source), sha256_file(source), contribution)


def package_bundle(
    *,
    generated_docx: Path,
    generated_pdf: Path,
    output_directory: Path,
    baseline_docx: Path,
    website_projects: Path,
    website_contact: Path,
    private_sources: Iterable[Path],
    data: CvData = CV_DATA,
) -> Path:
    output_directory = Path(output_directory)
    sources_directory = output_directory / "sources"
    sources_directory.mkdir(parents=True, exist_ok=True)

    _copy_with_manifest(
        generated_docx,
        output_directory / "Tomasz-Zielinski-Full-Stack-CV.docx",
        "Generated editable CV",
    )
    _copy_with_manifest(
        generated_pdf,
        output_directory / "Tomasz-Zielinski-Full-Stack-CV.pdf",
        "Generated PDF CV",
    )

    entries = [
        _copy_with_manifest(
            baseline_docx,
            sources_directory / "current-editable-cv.docx",
            "Previous editable CV used as the visual and structural baseline",
        ),
        _copy_with_manifest(
            website_projects,
            sources_directory / "website-projects.ts",
            "Current public project names, descriptions, technologies, and links",
        ),
        _copy_with_manifest(
            website_contact,
            sources_directory / "website-contact.tsx",
            "Current public contact details and profile links",
        ),
    ]

    public_evidence_path = sources_directory / "xelto-public-evidence.md"
    public_evidence_path.write_text(build_public_evidence(data), encoding="utf-8")
    entries.append(
        ManifestEntry(
            "generated",
            "public-safe synthesis of locally reviewed Xelto evidence",
            sha256_file(public_evidence_path),
            "Role progression, technical scope, and product areas used in the CV",
        )
    )

    for private_source in private_sources:
        private_source = Path(private_source).resolve()
        if not private_source.is_file():
            raise FileNotFoundError(private_source)
        entries.append(
            ManifestEntry(
                "not copied",
                str(private_source),
                sha256_file(private_source),
                "Internal evidence reviewed locally; excluded from the shareable bundle",
            )
        )

    manifest_path = sources_directory / "source-manifest.md"
    manifest_path.write_text(build_manifest(entries), encoding="utf-8")
    return output_directory


def _default_private_sources() -> tuple[Path, ...]:
    user_directory = Path.home()
    return (
        user_directory / "Downloads" / "Xelto-CV-Experience-Shareable.docx",
        user_directory
        / "Documents"
        / "Work"
        / "XELTO"
        / "deliverables"
        / "Xelto-CV-Experience-Shareable.docx",
        user_directory
        / "Documents"
        / "Work"
        / "XELTO"
        / "deliverables"
        / "xelto-proof-of-work"
        / "README.md",
    )


def main() -> None:
    repository_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Create the public-safe full-stack CV delivery bundle."
    )
    parser.add_argument("--docx", required=True, type=Path)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument(
        "--baseline-docx",
        type=Path,
        default=repository_root / "output" / "docx" / "tomasz_zielinski_editable.docx",
    )
    parser.add_argument(
        "--website-projects",
        type=Path,
        default=repository_root / "src" / "data" / "projects.ts",
    )
    parser.add_argument(
        "--website-contact",
        type=Path,
        default=repository_root / "src" / "pages" / "ContactPage.tsx",
    )
    parser.add_argument(
        "--private-source",
        action="append",
        dest="private_sources",
        type=Path,
        help="Internal evidence to reference by path and hash without copying",
    )
    arguments = parser.parse_args()

    package_bundle(
        generated_docx=arguments.docx,
        generated_pdf=arguments.pdf,
        output_directory=arguments.output_dir,
        baseline_docx=arguments.baseline_docx,
        website_projects=arguments.website_projects,
        website_contact=arguments.website_contact,
        private_sources=arguments.private_sources or _default_private_sources(),
    )


if __name__ == "__main__":
    main()
