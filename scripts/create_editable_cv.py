from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_BREAK, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


SERIF_FONT = "Georgia"
SANS_FONT = "Arial"
INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x88, 0x88, 0x88)
CONTENT_WIDTH = Inches(7.5)


@dataclass(frozen=True)
class Entry:
    title_runs: tuple[tuple[str, bool], ...]
    date: str
    descriptions: tuple[str, ...]


PROJECTS = (
    Entry(
        (("Haskell Interpreter", True), ("  ·  Haskell, Yacc", True)),
        "March 2019",
        ("Language and interpreter written in Haskell for processing custom stream data files",),
    ),
    Entry(
        (("GPU Particles", True), ("  ·  Typescript, GLSL", True)),
        "February 2019",
        ("WebGL particle simulation driven by GLSL shaders",),
    ),
    Entry(
        (("Flappy-Pixie", True), ("  ·  Javascript, WebGL", True)),
        "October 2018",
        (
            "Flappy Bird clone with a 3D parallax background. Completed for an interview challenge in one week",
        ),
    ),
    Entry(
        (("Endless-City", True), ("  ·  Javascript, Three.js", True)),
        "September 2018",
        ("Interactive infinite city scene inspired by Little Workshop with custom glTF 2.0 loader",),
    ),
    Entry(
        (("Sushi-Go", True), ("  ·  Java, Swing", True)),
        "April 2018",
        (
            "Multithreaded business software prototype with socket communication and able to save/load configuration files",
        ),
    ),
    Entry(
        (("Fitmed", True), ("  ·  React, Redux, Node.js, MongoDB", True)),
        "July 2018",
        ("Prototype platform for dieticians with API, authentication and input validation",),
    ),
)


def _set_font(run, name: str, size: float, color: RGBColor, bold: bool = False) -> None:
    run.font.name = name
    run.font.size = Pt(size)
    run.font.color.rgb = color
    run.font.bold = bold
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)


def _set_style_font(style, name: str, size: float, color: RGBColor, bold: bool = False) -> None:
    style.font.name = name
    style.font.size = Pt(size)
    style.font.color.rgb = color
    style.font.bold = bold
    r_pr = style.element.get_or_add_rPr()
    r_pr.rFonts.set(qn("w:ascii"), name)
    r_pr.rFonts.set(qn("w:hAnsi"), name)


def add_hyperlink(paragraph, text: str, url: str, color: str = "888888") -> None:
    relationship_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relationship_id)

    run = OxmlElement("w:r")
    run_properties = OxmlElement("w:rPr")

    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), SANS_FONT)
    fonts.set(qn("w:hAnsi"), SANS_FONT)
    run_properties.append(fonts)

    size = OxmlElement("w:sz")
    size.set(qn("w:val"), "19")
    run_properties.append(size)

    run_color = OxmlElement("w:color")
    run_color.set(qn("w:val"), color)
    run_properties.append(run_color)

    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "none")
    run_properties.append(underline)

    run.append(run_properties)
    text_element = OxmlElement("w:t")
    text_element.text = text
    run.append(text_element)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


def _add_right_tab(paragraph) -> None:
    paragraph.paragraph_format.tab_stops.add_tab_stop(CONTENT_WIDTH, WD_TAB_ALIGNMENT.RIGHT)


def add_title_date(document: Document, title_runs: tuple[tuple[str, bool], ...], date: str) -> None:
    paragraph = document.add_paragraph(style="CV Entry")
    paragraph.paragraph_format.keep_with_next = True
    _add_right_tab(paragraph)

    for text, bold in title_runs:
        run = paragraph.add_run(text)
        _set_font(run, SANS_FONT, 9.4, INK, bold=bold)

    paragraph.add_run("\t")
    date_run = paragraph.add_run(date)
    _set_font(date_run, SANS_FONT, 9.2, MUTED)


def _add_description(document: Document, text: str, *, before: float = 0) -> None:
    paragraph = document.add_paragraph(style="CV Description")
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.add_run(text)


def _add_labeled_line(document: Document, label: str, value: str) -> None:
    paragraph = document.add_paragraph(style="CV Description")
    label_run = paragraph.add_run(label)
    _set_font(label_run, SANS_FONT, 9.3, INK, bold=True)
    value_run = paragraph.add_run(value)
    _set_font(value_run, SANS_FONT, 9.3, INK)


def _next_numbering_id(numbering, element_name: str, attribute_name: str) -> int:
    values = []
    for element in numbering.findall(qn(element_name)):
        raw_value = element.get(qn(attribute_name))
        if raw_value is not None:
            values.append(int(raw_value))
    return max(values, default=0) + 1


def _create_bullet_numbering(document: Document) -> int:
    numbering = document.part.numbering_part.element
    abstract_id = _next_numbering_id(numbering, "w:abstractNum", "w:abstractNumId")
    number_id = _next_numbering_id(numbering, "w:num", "w:numId")

    abstract = OxmlElement("w:abstractNum")
    abstract.set(qn("w:abstractNumId"), str(abstract_id))

    multi_level_type = OxmlElement("w:multiLevelType")
    multi_level_type.set(qn("w:val"), "singleLevel")
    abstract.append(multi_level_type)

    level = OxmlElement("w:lvl")
    level.set(qn("w:ilvl"), "0")
    start = OxmlElement("w:start")
    start.set(qn("w:val"), "1")
    level.append(start)
    number_format = OxmlElement("w:numFmt")
    number_format.set(qn("w:val"), "bullet")
    level.append(number_format)
    level_text = OxmlElement("w:lvlText")
    level_text.set(qn("w:val"), "•")
    level.append(level_text)
    justification = OxmlElement("w:lvlJc")
    justification.set(qn("w:val"), "left")
    level.append(justification)

    paragraph_properties = OxmlElement("w:pPr")
    tabs = OxmlElement("w:tabs")
    tab = OxmlElement("w:tab")
    tab.set(qn("w:val"), "num")
    tab.set(qn("w:pos"), "220")
    tabs.append(tab)
    paragraph_properties.append(tabs)
    indent = OxmlElement("w:ind")
    indent.set(qn("w:left"), "220")
    indent.set(qn("w:hanging"), "140")
    paragraph_properties.append(indent)
    level.append(paragraph_properties)

    run_properties = OxmlElement("w:rPr")
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), SANS_FONT)
    fonts.set(qn("w:hAnsi"), SANS_FONT)
    run_properties.append(fonts)
    level.append(run_properties)
    abstract.append(level)
    numbering.append(abstract)

    number = OxmlElement("w:num")
    number.set(qn("w:numId"), str(number_id))
    abstract_reference = OxmlElement("w:abstractNumId")
    abstract_reference.set(qn("w:val"), str(abstract_id))
    number.append(abstract_reference)
    numbering.append(number)
    return number_id


def _add_bullet(document: Document, text: str, number_id: int) -> None:
    paragraph = document.add_paragraph(style="CV Bullet")
    paragraph_properties = paragraph._p.get_or_add_pPr()
    numbering_properties = OxmlElement("w:numPr")
    level = OxmlElement("w:ilvl")
    level.set(qn("w:val"), "0")
    numbering_properties.append(level)
    number = OxmlElement("w:numId")
    number.set(qn("w:val"), str(number_id))
    numbering_properties.append(number)
    paragraph_properties.append(numbering_properties)
    paragraph.add_run(text)


def _add_style(document: Document, name: str):
    styles = document.styles
    if name in styles:
        return styles[name]
    return styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)


def configure_document(document: Document) -> None:
    section = document.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.52)
    section.bottom_margin = Inches(0.42)
    section.left_margin = Inches(0.5)
    section.right_margin = Inches(0.5)
    section.header_distance = Inches(0.2)
    section.footer_distance = Inches(0.2)

    normal = document.styles["Normal"]
    _set_style_font(normal, SANS_FONT, 9.3, INK)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    heading = document.styles["Heading 1"]
    _set_style_font(heading, SERIF_FONT, 18, MUTED)
    heading.paragraph_format.space_before = Pt(9)
    heading.paragraph_format.space_after = Pt(5)
    heading.paragraph_format.keep_with_next = True
    heading.paragraph_format.keep_together = True

    title = _add_style(document, "CV Title")
    _set_style_font(title, SERIF_FONT, 30, INK)
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(8)
    title.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    entry = _add_style(document, "CV Entry")
    _set_style_font(entry, SANS_FONT, 9.4, INK, bold=True)
    entry.paragraph_format.space_before = Pt(2.5)
    entry.paragraph_format.space_after = Pt(0)
    entry.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    description = _add_style(document, "CV Description")
    _set_style_font(description, SANS_FONT, 9.3, INK)
    description.paragraph_format.space_before = Pt(0)
    description.paragraph_format.space_after = Pt(1)
    description.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    bullet = _add_style(document, "CV Bullet")
    _set_style_font(bullet, SANS_FONT, 9.3, INK)
    bullet.paragraph_format.space_before = Pt(0)
    bullet.paragraph_format.space_after = Pt(0)
    bullet.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    footer = _add_style(document, "CV Footer")
    _set_style_font(footer, SANS_FONT, 8.4, INK)
    footer.paragraph_format.space_before = Pt(10)
    footer.paragraph_format.space_after = Pt(0)
    footer.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE


def _add_header(document: Document) -> None:
    paragraph = document.add_paragraph(style="CV Title")
    _add_right_tab(paragraph)

    name = paragraph.add_run("Tomasz Zielinski")
    _set_font(name, SERIF_FONT, 30, INK)
    paragraph.add_run("\t")
    add_hyperlink(paragraph, "www.zielin.ski", "https://www.zielin.ski")

    line_break = paragraph.add_run()
    line_break.add_break(WD_BREAK.LINE)
    paragraph.add_run("\t")
    add_hyperlink(paragraph, "contact@zielin.ski", "mailto:contact@zielin.ski")

    line_break = paragraph.add_run()
    line_break.add_break(WD_BREAK.LINE)
    paragraph.add_run("\t")
    phone = paragraph.add_run("07519554924")
    _set_font(phone, SANS_FONT, 9.5, MUTED)


def build_cv(output_path: Path) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    document = Document()
    configure_document(document)
    document.core_properties.title = "Tomasz Zielinski - CV"
    document.core_properties.author = "Tomasz Zielinski"
    document.core_properties.subject = "Curriculum Vitae"

    bullet_number_id = _create_bullet_numbering(document)
    _add_header(document)

    document.add_heading("Professional Experience", level=1)
    add_title_date(
        document,
        (("Freelance Web Development", True), ("  ·  Poznan, Poland", True)),
        "May - August 2018",
    )
    _add_bullet(document, "Created responsive single page app components for clients", bullet_number_id)
    _add_bullet(
        document,
        "Improved speed and scalability, optimized websites for search engines",
        bullet_number_id,
    )
    _add_bullet(document, "Developed using primarily MERN stack", bullet_number_id)

    document.add_heading("Education", level=1)
    add_title_date(
        document,
        (("University of Southampton", True), ("  ·  Southampton, United Kingdom", True)),
        "August 2017 - Present",
    )
    _add_description(document, "Bachelor of Science in Computer Science, expected in July 2020")
    coursework = document.add_paragraph(style="CV Description")
    coursework.paragraph_format.space_before = Pt(4)
    label = coursework.add_run("Relevant Coursework: ")
    _set_font(label, SANS_FONT, 9.3, INK, bold=True)
    value = coursework.add_run(
        "Algorithmics, Cloud Application Development, Computer Systems, Data Management,\n"
        "Distributed Systems and Networks, Theory of Computing, Intelligent Systems, Web Infrastructure"
    )
    _set_font(value, SANS_FONT, 9.3, INK)

    add_title_date(
        document,
        (("Poznan University of Technology", True), ("  ·  Poznan, Poland", True)),
        "August 2016 - May 2017",
    )
    _add_description(
        document,
        "First-year Bachelor of Science in Information Engineering, Faculty of Electrical Engineering",
    )

    document.add_heading("Projects", level=1)
    for project in PROJECTS:
        add_title_date(document, project.title_runs, project.date)
        for description in project.descriptions:
            _add_description(document, description)

    document.add_heading("Technical Skills", level=1)
    _add_labeled_line(
        document,
        "Programming:  ",
        "Javascript, React, Node.js, SCSS, Java, SQL, Bash, TypeScript, WebGL, C++",
    )
    _add_labeled_line(document, "Software:  ", "Visual Studio Code, Git, MongoDB, Photoshop")
    _add_labeled_line(document, "Languages:  ", "English, Polish")

    consent = document.add_paragraph(style="CV Footer")
    consent.add_run(
        "I hereby consent to the processing of personal data in this document  by anyone who receives it "
        "for the sole purpose of consideration of my skills\nand experience for professional opportunities"
    )

    document.save(output_path)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the editable Tomasz Zielinski CV.")
    parser.add_argument("output", type=Path, help="Destination DOCX path")
    arguments = parser.parse_args()
    build_cv(arguments.output)


if __name__ == "__main__":
    main()
