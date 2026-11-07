from __future__ import annotations

import argparse
from pathlib import Path

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING, WD_TAB_ALIGNMENT
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Emu, Mm, Pt, RGBColor
from reportlab.lib.colors import Color, black
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from full_stack_cv_content import CV_DATA, CvData, Project, Role


SERIF_FONT = "Times New Roman"
SANS_FONT = "Calibri"
INK = RGBColor(0x11, 0x11, 0x11)
MUTED = RGBColor(0x88, 0x88, 0x88)
SUBTLE = RGBColor(0x44, 0x44, 0x44)
META = RGBColor(0x78, 0x78, 0x78)
# Heading levels darken with importance: section headings are black, entry
# titles slightly lighter, job titles lighter again, technology lines lightest.
ENTRY_TITLE_COLOR = RGBColor(0x1A, 0x1A, 0x1A)
POSITION_COLOR = RGBColor(0x55, 0x55, 0x55)
HEADING_LETTER_SPACING = 0.8
PAGE_WIDTH = Mm(210)
PAGE_HEIGHT = Mm(297)
SIDE_MARGIN = Mm(12.7)
CONTENT_WIDTH = Emu(PAGE_WIDTH - 2 * SIDE_MARGIN)
HEADER_COLUMNS = (Emu(CONTENT_WIDTH - Mm(72)), Mm(72))
PDF_MUTED = Color(0.53, 0.53, 0.53)
PDF_SUBTLE = Color(0.27, 0.27, 0.27)
PDF_META = Color(0.47, 0.47, 0.47)
PDF_ENTRY_TITLE_COLOR = Color(0.1, 0.1, 0.1)
PDF_POSITION_COLOR = Color(0.33, 0.33, 0.33)


def _phone_url(phone: str) -> str:
    return "tel:" + "".join(character for character in phone if character in "+0123456789")


def contact_rows(data: CvData) -> tuple[tuple[str, str], ...]:
    identity = data.identity
    return (
        (identity.website_text, identity.website_url),
        (identity.email, f"mailto:{identity.email}"),
        (identity.phone, _phone_url(identity.phone)),
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
    # Built-in styles such as Heading 1 point at theme fonts, which override
    # the explicit font names above.
    for theme_attribute in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        r_pr.rFonts.attrib.pop(qn(theme_attribute), None)


def add_hyperlink(
    paragraph,
    text: str,
    url: str,
    color: str = "888888",
    size: float = 9,
) -> None:
    relationship_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relationship_id)

    run = OxmlElement("w:r")
    run_properties = OxmlElement("w:rPr")

    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), SANS_FONT)
    fonts.set(qn("w:hAnsi"), SANS_FONT)
    run_properties.append(fonts)

    size_element = OxmlElement("w:sz")
    size_element.set(qn("w:val"), str(int(round(size * 2))))
    run_properties.append(size_element)

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



def add_title_date(
    document: Document,
    title: str,
    date: str,
    *,
    style: str = "CV Entry Title",
    suffix: str = "",
):
    paragraph = document.add_paragraph(style=style)
    paragraph.paragraph_format.keep_with_next = True
    _add_right_tab(paragraph)
    paragraph.add_run(title)
    if suffix:
        suffix_run = paragraph.add_run(suffix)
        suffix_run.font.bold = False
        suffix_run.font.size = Pt(9)
        suffix_run.font.color.rgb = META
    paragraph.add_run("\t")
    date_run = paragraph.add_run(date)
    _set_font(date_run, SANS_FONT, 9, MUTED)
    return paragraph


def _add_meta(document: Document, text: str, url: str = "", url_text: str = ""):
    paragraph = document.add_paragraph(style="CV Meta")
    paragraph.paragraph_format.keep_with_next = True
    paragraph.add_run(text)
    if url and url_text:
        paragraph.add_run("  \N{MIDDLE DOT}  ")
        add_hyperlink(paragraph, url_text, url, color="787878", size=9)
    return paragraph


def _add_description(
    document: Document,
    text: str,
    *,
    before: float = 0,
    after: float | None = None,
):
    paragraph = document.add_paragraph(style="CV Description")
    paragraph.paragraph_format.space_before = Pt(before)
    if after is not None:
        paragraph.paragraph_format.space_after = Pt(after)
    paragraph.add_run(text)
    return paragraph


def _add_labeled_line(document: Document, label: str, value: str, *, after: float) -> None:
    paragraph = document.add_paragraph(style="CV Skill")
    paragraph.paragraph_format.space_after = Pt(after)
    label_run = paragraph.add_run(label)
    _set_font(label_run, SANS_FONT, 9, INK, bold=True)
    value_run = paragraph.add_run(value)
    _set_font(value_run, SANS_FONT, 9, INK)


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


def _add_bullet(document: Document, text: str, number_id: int):
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
    if text:
        paragraph.add_run(text)
    return paragraph


def _add_style(document: Document, name: str):
    styles = document.styles
    if name in styles:
        return styles[name]
    return styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)


def _set_heading_rule(style) -> None:
    """Letter-space the heading and draw a thin grey rule under it."""
    run_properties = style.element.get_or_add_rPr()
    spacing = OxmlElement("w:spacing")
    spacing.set(qn("w:val"), str(round(HEADING_LETTER_SPACING * 20)))
    run_properties.append(spacing)

    paragraph_properties = style.element.get_or_add_pPr()
    borders = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "4")
    bottom.set(qn("w:space"), "1")
    bottom.set(qn("w:color"), "BFBFBF")
    borders.append(bottom)
    paragraph_properties.append(borders)


def configure_document(document: Document) -> None:
    section = document.sections[0]
    section.page_width = PAGE_WIDTH
    section.page_height = PAGE_HEIGHT
    section.top_margin = Mm(11)
    section.bottom_margin = Mm(10)
    section.left_margin = SIDE_MARGIN
    section.right_margin = SIDE_MARGIN
    section.header_distance = Mm(5)
    section.footer_distance = Mm(5)

    normal = document.styles["Normal"]
    _set_style_font(normal, SANS_FONT, 9, INK)
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(0)
    normal.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    # Section headings sit closer to the content they introduce than to the
    # section above them.
    heading = document.styles["Heading 1"]
    _set_style_font(heading, SANS_FONT, 11, INK, bold=True)
    heading.font.all_caps = True
    _set_heading_rule(heading)
    heading.paragraph_format.space_before = Pt(11)
    heading.paragraph_format.space_after = Pt(3)
    heading.paragraph_format.keep_with_next = True
    heading.paragraph_format.keep_together = True

    title = _add_style(document, "CV Title")
    _set_style_font(title, SERIF_FONT, 26, INK)
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(0)
    title.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    contact = _add_style(document, "CV Contact")
    _set_style_font(contact, SANS_FONT, 9, MUTED)
    contact.paragraph_format.space_before = Pt(0)
    contact.paragraph_format.space_after = Pt(0)
    contact.paragraph_format.line_spacing = Pt(10.5)

    role = _add_style(document, "CV Role")
    _set_style_font(role, SANS_FONT, 11, SUBTLE, bold=True)
    role.paragraph_format.space_before = Pt(2)
    role.paragraph_format.space_after = Pt(0)
    role.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    # Company, project, and institution names.
    entry_title = _add_style(document, "CV Entry Title")
    _set_style_font(entry_title, SANS_FONT, 10.5, ENTRY_TITLE_COLOR, bold=True)
    entry_title.paragraph_format.space_before = Pt(5)
    entry_title.paragraph_format.space_after = Pt(0.5)
    entry_title.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    # Job titles nested under a company.
    position = _add_style(document, "CV Position")
    _set_style_font(position, SANS_FONT, 9.5, POSITION_COLOR, bold=True)
    position.paragraph_format.space_before = Pt(3)
    position.paragraph_format.space_after = Pt(0.5)
    position.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    # Technology lines under an entry title.
    meta = _add_style(document, "CV Meta")
    _set_style_font(meta, SANS_FONT, 9, META)
    meta.paragraph_format.space_before = Pt(0)
    meta.paragraph_format.space_after = Pt(0.5)
    meta.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    description = _add_style(document, "CV Description")
    _set_style_font(description, SANS_FONT, 9, INK)
    description.paragraph_format.space_before = Pt(0)
    description.paragraph_format.space_after = Pt(1)
    description.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    description.paragraph_format.left_indent = Pt(0)

    skill = _add_style(document, "CV Skill")
    _set_style_font(skill, SANS_FONT, 9, INK)
    skill.paragraph_format.space_before = Pt(0)
    skill.paragraph_format.space_after = Pt(0.5)
    skill.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE

    bullet = _add_style(document, "CV Bullet")
    _set_style_font(bullet, SANS_FONT, 9, INK)
    bullet.paragraph_format.space_before = Pt(0)
    bullet.paragraph_format.space_after = Pt(0.6)
    bullet.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE



def _set_cell_margins(cell, value: int = 0) -> None:
    cell_properties = cell._tc.get_or_add_tcPr()
    margins = cell_properties.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        cell_properties.append(margins)
    for edge in ("top", "left", "bottom", "right"):
        element = margins.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            margins.append(element)
        element.set(qn("w:w"), str(value))
        element.set(qn("w:type"), "dxa")


def _set_header_table_geometry(table) -> None:
    column_widths = tuple(int(width.twips) for width in HEADER_COLUMNS)
    table_properties = table._tbl.tblPr

    table_width = table_properties.first_child_found_in("w:tblW")
    table_width.set(qn("w:type"), "dxa")
    table_width.set(qn("w:w"), str(sum(column_widths)))

    table_indent = table_properties.first_child_found_in("w:tblInd")
    if table_indent is None:
        table_indent = OxmlElement("w:tblInd")
        table_properties.append(table_indent)
    table_indent.set(qn("w:type"), "dxa")
    table_indent.set(qn("w:w"), "0")

    grid = table._tbl.tblGrid
    for column in list(grid):
        grid.remove(column)
    for width in column_widths:
        column = OxmlElement("w:gridCol")
        column.set(qn("w:w"), str(width))
        grid.append(column)



def _add_header(document: Document, data: CvData) -> None:
    table = document.add_table(rows=1, cols=2)
    table.autofit = False
    left, right = table.rows[0].cells
    left_width, right_width = HEADER_COLUMNS
    left.width = left_width
    right.width = right_width
    _set_header_table_geometry(table)
    for cell in (left, right):
        _set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP

    name_paragraph = left.paragraphs[0]
    name_paragraph.style = "CV Title"
    name = name_paragraph.add_run(data.identity.name)
    _set_font(name, SERIF_FONT, 26, INK)

    role_paragraph = left.add_paragraph(style="CV Role")
    role_paragraph.add_run(data.identity.role)

    contact = right.paragraphs[0]
    contact.style = "CV Contact"
    contact.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for index, (text, url) in enumerate(contact_rows(data)):
        if index:
            line_break = contact.add_run()
            line_break.add_break(WD_BREAK.LINE)
        add_hyperlink(contact, text, url, size=9)


def _add_section_heading(document: Document, text: str):
    paragraph = document.add_heading(text, level=1)
    paragraph.paragraph_format.keep_with_next = True
    return paragraph


def _add_product_bullet(document: Document, product: Project, number_id: int) -> None:
    paragraph = _add_bullet(document, "", number_id)
    name = paragraph.add_run(f"{product.title}:")
    name.font.bold = True
    paragraph.add_run(f" {product.description}")


def _add_stack_line(document: Document, role: Role) -> None:
    paragraph = document.add_paragraph(style="CV Meta")
    paragraph.paragraph_format.keep_with_next = True
    label = paragraph.add_run("Stack:")
    label.font.bold = True
    paragraph.add_run(" " + ", ".join(role.stack))


def _add_role(document: Document, role: Role, bullet_number_id: int) -> None:
    add_title_date(document, role.title, role.period, style="CV Position")
    if role.stack:
        _add_stack_line(document, role)
    for product in role.products:
        _add_product_bullet(document, product, bullet_number_id)
    for bullet in role.bullets:
        _add_bullet(document, bullet, bullet_number_id)


def _add_project(document: Document, project: Project) -> None:
    add_title_date(document, project.title, project.period)
    _add_meta(document, project.tools, project.url, project.url_text)
    _add_description(document, project.description)


def build_cv(output_path: Path) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    document = Document()
    configure_document(document)
    document.core_properties.title = "Tomasz Zielinski - CV"
    document.core_properties.author = "Tomasz Zielinski"
    document.core_properties.subject = "Curriculum Vitae"

    bullet_number_id = _create_bullet_numbering(document)
    _add_header(document, CV_DATA)

    _add_section_heading(document, "Profile")
    _add_description(document, CV_DATA.profile)

    _add_section_heading(document, "Professional Experience")
    add_title_date(document, CV_DATA.employment.company, CV_DATA.employment.period)
    for role in CV_DATA.employment.roles:
        _add_role(document, role, bullet_number_id)
    freelance_title, freelance_place, freelance_period = (
        part.strip() for part in CV_DATA.earlier_experience[0].split("|")
    )
    add_title_date(
        document,
        freelance_title,
        freelance_period,
        suffix=f"  \N{MIDDLE DOT}  {freelance_place}",
    )
    _add_description(document, CV_DATA.earlier_experience[1])

    _add_section_heading(document, "Technologies")
    for label, technologies in CV_DATA.technology_groups:
        _add_labeled_line(
            document,
            f"{label}:  ",
            ", ".join(technologies),
            after=0.5,
        )

    _add_section_heading(document, "Projects")
    for project in CV_DATA.personal_projects:
        _add_project(document, project)

    _add_section_heading(document, "Education")
    for education in CV_DATA.education:
        add_title_date(document, education.institution, education.period)
        _add_description(document, education.qualification)

    _add_section_heading(document, "Additional Information")
    _add_labeled_line(
        document,
        "Languages:  ",
        ", ".join(CV_DATA.languages),
        after=0.5,
    )

    document.save(output_path)
    return output_path


PDF_SERIF = "CvTimes"
PDF_SANS = "CvCalibri"
PDF_SANS_BOLD = "CvCalibriBold"
PDF_BODY = 9
PDF_LEADING = 11.6
PDF_SECTION = 11
PDF_RULE = Color(0.75, 0.75, 0.75)
PDF_ENTRY = 10.5
PDF_POSITION = 9.5
PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT = A4
PDF_LEFT = 36
PDF_RIGHT = PDF_PAGE_WIDTH - 36
PDF_WIDTH = PDF_RIGHT - PDF_LEFT
# Space above a section heading is roughly twice the space below it, so each
# heading reads as part of the section that follows.
PDF_SECTION_BEFORE = 18
PDF_SECTION_AFTER = 15
PDF_ENTRY_GAP = 7
PDF_FONT_CANDIDATES = {
    PDF_SERIF: (
        Path(r"C:\Windows\Fonts\times.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"),
    ),
    PDF_SANS: (
        Path(r"C:\Windows\Fonts\calibri.ttf"),
        Path("/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf"),
    ),
    PDF_SANS_BOLD: (
        Path(r"C:\Windows\Fonts\calibrib.ttf"),
        Path("/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf"),
    ),
}

Segment = tuple[str, str, Color]


def _register_pdf_fonts() -> None:
    registered = set(pdfmetrics.getRegisteredFontNames())
    for name, candidates in PDF_FONT_CANDIDATES.items():
        if name in registered:
            continue
        path = next((candidate for candidate in candidates if candidate.is_file()), None)
        if path is None:
            raise FileNotFoundError(
                f"None of the fonts for {name} were found: "
                + ", ".join(str(candidate) for candidate in candidates)
            )
        pdfmetrics.registerFont(TTFont(name, str(path)))


def _pdf_header(pdf: canvas.Canvas, data: CvData) -> float:
    top = PDF_PAGE_HEIGHT - 50
    pdf.setFillColor(black)
    pdf.setFont(PDF_SERIF, 28)
    pdf.drawString(PDF_LEFT, top, data.identity.name)
    pdf.setFont(PDF_SANS_BOLD, 11)
    pdf.setFillColor(PDF_SUBTLE)
    pdf.drawString(PDF_LEFT, top - 20, data.identity.role)

    pdf.setFont(PDF_SANS, PDF_BODY)
    pdf.setFillColor(PDF_MUTED)
    y = top + 8
    for text, url in contact_rows(data):
        pdf.drawRightString(PDF_RIGHT, y, text)
        width = stringWidth(text, PDF_SANS, PDF_BODY)
        pdf.linkURL(url, (PDF_RIGHT - width, y - 2, PDF_RIGHT, y + 8), relative=0)
        y -= 11
    return min(y, top - 20) - 6


def _pdf_section(pdf: canvas.Canvas, title: str, y: float) -> float:
    y -= PDF_SECTION_BEFORE
    pdf.setFillColor(black)
    text = pdf.beginText(PDF_LEFT, y)
    text.setFont(PDF_SANS_BOLD, PDF_SECTION)
    text.setCharSpace(HEADING_LETTER_SPACING)
    text.textOut(title.upper())
    # Character spacing persists in the page's text state, so reset it.
    text.setCharSpace(0)
    pdf.drawText(text)
    pdf.setStrokeColor(PDF_RULE)
    pdf.setLineWidth(0.6)
    pdf.line(PDF_LEFT, y - 4, PDF_RIGHT, y - 4)
    return y - PDF_SECTION_AFTER - 2


def _wrap_segments(segments: list[Segment], width: float) -> list[list[Segment]]:
    """Greedy word wrap that keeps each word's font and colour."""
    words: list[tuple[str, str, Color, bool]] = []
    for text, font, color in segments:
        leading_space = text[:1].isspace()
        for index, word in enumerate(text.split()):
            words.append((word, font, color, index > 0 or leading_space))

    lines: list[list[Segment]] = []
    line: list[Segment] = []
    line_width = 0.0
    for word, font, color, spaced in words:
        prefix = " " if spaced and line else ""
        piece_width = stringWidth(prefix + word, font, PDF_BODY)
        if line and line_width + piece_width > width:
            lines.append(line)
            line, line_width, prefix = [], 0.0, ""
            piece_width = stringWidth(word, font, PDF_BODY)
        line.append((prefix + word, font, color))
        line_width += piece_width
    if line:
        lines.append(line)
    return lines


def _pdf_rich_text(
    pdf: canvas.Canvas,
    segments: list[Segment],
    x: float,
    y: float,
    width: float,
) -> float:
    for line in _wrap_segments(segments, width):
        cursor = x
        for text, font, color in line:
            pdf.setFont(font, PDF_BODY)
            pdf.setFillColor(color)
            pdf.drawString(cursor, y, text)
            cursor += stringWidth(text, font, PDF_BODY)
        y -= PDF_LEADING
    return y


def _pdf_text(pdf: canvas.Canvas, text: str, y: float, *, x: float = PDF_LEFT) -> float:
    return _pdf_rich_text(pdf, [(text, PDF_SANS, black)], x, y, PDF_RIGHT - x)


def _pdf_entry_title(
    pdf: canvas.Canvas,
    title: str,
    date: str,
    y: float,
    *,
    suffix: str = "",
) -> float:
    pdf.setFillColor(PDF_ENTRY_TITLE_COLOR)
    pdf.setFont(PDF_SANS_BOLD, PDF_ENTRY)
    pdf.drawString(PDF_LEFT, y, title)
    if suffix:
        pdf.setFillColor(PDF_META)
        pdf.setFont(PDF_SANS, PDF_BODY)
        pdf.drawString(PDF_LEFT + stringWidth(title, PDF_SANS_BOLD, PDF_ENTRY), y, suffix)
    pdf.setFillColor(PDF_MUTED)
    pdf.setFont(PDF_SANS, PDF_BODY)
    pdf.drawRightString(PDF_RIGHT, y, date)
    return y - 13


def _pdf_position(pdf: canvas.Canvas, title: str, date: str, y: float) -> float:
    pdf.setFillColor(PDF_POSITION_COLOR)
    pdf.setFont(PDF_SANS_BOLD, PDF_POSITION)
    pdf.drawString(PDF_LEFT, y, title)
    pdf.setFillColor(PDF_MUTED)
    pdf.setFont(PDF_SANS, PDF_BODY)
    pdf.drawRightString(PDF_RIGHT, y, date)
    return y - 11


def _pdf_meta(pdf: canvas.Canvas, project: Project, y: float) -> float:
    pdf.setFillColor(PDF_META)
    pdf.setFont(PDF_SANS, PDF_BODY)
    pdf.drawString(PDF_LEFT, y, project.tools)
    if project.url and project.url_text:
        x = PDF_LEFT + stringWidth(project.tools, PDF_SANS, PDF_BODY)
        separator = "  \N{MIDDLE DOT}  "
        pdf.drawString(x, y, separator)
        x += stringWidth(separator, PDF_SANS, PDF_BODY)
        pdf.drawString(x, y, project.url_text)
        width = stringWidth(project.url_text, PDF_SANS, PDF_BODY)
        pdf.linkURL(project.url, (x, y - 2, x + width, y + 8), relative=0)
    return y - PDF_LEADING


def _pdf_labeled_line(pdf: canvas.Canvas, label: str, value: str, y: float) -> float:
    return _pdf_rich_text(
        pdf,
        [(label, PDF_SANS_BOLD, black), (" " + value, PDF_SANS, black)],
        PDF_LEFT,
        y,
        PDF_WIDTH,
    )


def _pdf_bullet(pdf: canvas.Canvas, segments: list[Segment], y: float) -> float:
    pdf.setFillColor(black)
    pdf.setFont(PDF_SANS, PDF_BODY)
    pdf.drawString(PDF_LEFT + 1, y, "\N{BULLET}")
    return _pdf_rich_text(pdf, segments, PDF_LEFT + 9, y, PDF_WIDTH - 9) - 0.6


def _pdf_role(pdf: canvas.Canvas, role: Role, y: float) -> float:
    y = _pdf_position(pdf, role.title, role.period, y)
    if role.stack:
        y = _pdf_rich_text(
            pdf,
            [("Stack:", PDF_SANS_BOLD, PDF_META), (" " + ", ".join(role.stack), PDF_SANS, PDF_META)],
            PDF_LEFT,
            y,
            PDF_WIDTH,
        ) - 1
    for product in role.products:
        y = _pdf_bullet(
            pdf,
            [
                (f"{product.title}:", PDF_SANS_BOLD, black),
                (" " + product.description, PDF_SANS, black),
            ],
            y,
        )
    for bullet in role.bullets:
        y = _pdf_bullet(pdf, [(bullet, PDF_SANS, black)], y)
    return y - 2


def build_pdf(output_path: Path) -> Path:
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    _register_pdf_fonts()

    pdf = canvas.Canvas(
        str(output_path),
        pagesize=A4,
        pageCompression=1,
        initialFontName=PDF_SANS,
        initialFontSize=PDF_BODY,
    )
    pdf.setTitle("Tomasz Zielinski - Full-Stack Developer CV")
    pdf.setAuthor(CV_DATA.identity.name)
    pdf.setSubject("Curriculum Vitae")
    pdf.setCreator("scripts/create_editable_cv.py")
    pdf.setKeywords(
        [technology for _, technologies in CV_DATA.technology_groups for technology in technologies]
    )

    y = _pdf_header(pdf, CV_DATA)
    y = _pdf_section(pdf, "Profile", y)
    y = _pdf_text(pdf, CV_DATA.profile, y)

    y = _pdf_section(pdf, "Professional Experience", y)
    y = _pdf_entry_title(pdf, CV_DATA.employment.company, CV_DATA.employment.period, y)
    for role in CV_DATA.employment.roles:
        y = _pdf_role(pdf, role, y)
    freelance_title, freelance_place, freelance_period = (
        part.strip() for part in CV_DATA.earlier_experience[0].split("|")
    )
    y = _pdf_entry_title(
        pdf,
        freelance_title,
        freelance_period,
        y - PDF_ENTRY_GAP + 2,
        suffix=f"  \N{MIDDLE DOT}  {freelance_place}",
    )
    y = _pdf_text(pdf, CV_DATA.earlier_experience[1], y)

    y = _pdf_section(pdf, "Technologies", y)
    for label, technologies in CV_DATA.technology_groups:
        y = _pdf_labeled_line(pdf, f"{label}:", ", ".join(technologies), y)

    y = _pdf_section(pdf, "Projects", y)
    for index, project in enumerate(CV_DATA.personal_projects):
        if index:
            y -= PDF_ENTRY_GAP
        y = _pdf_entry_title(pdf, project.title, project.period, y)
        y = _pdf_meta(pdf, project, y)
        y = _pdf_text(pdf, project.description, y)

    y = _pdf_section(pdf, "Education", y)
    for index, education in enumerate(CV_DATA.education):
        if index:
            y -= PDF_ENTRY_GAP
        y = _pdf_entry_title(pdf, education.institution, education.period, y)
        y = _pdf_text(pdf, education.qualification, y)

    y = _pdf_section(pdf, "Additional Information", y)
    _pdf_labeled_line(pdf, "Languages:", ", ".join(CV_DATA.languages), y)

    pdf.showPage()
    pdf.save()
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Create the editable Tomasz Zielinski CV.")
    parser.add_argument("output", type=Path, help="Destination DOCX path")
    parser.add_argument("--pdf", action="store_true", help="Create a PDF instead of a DOCX")
    arguments = parser.parse_args()
    if arguments.pdf:
        build_pdf(arguments.output)
    else:
        build_cv(arguments.output)


if __name__ == "__main__":
    main()
