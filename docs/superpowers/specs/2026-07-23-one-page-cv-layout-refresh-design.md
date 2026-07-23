# One-Page CV Layout Refresh

## Goal

Condense the current two-page Full-Stack Engineer CV into one US Letter page
without changing its established visual character. Improve the information
hierarchy, remove social links, and keep the editable DOCX and PDF aligned.

## Content Changes

- Remove the GitHub and LinkedIn rows from the header.
- Remove every personal-project hyperlink and the visible `View project` text.
- Keep the website, email address, and phone number in the header.
- Add this sentence to the profile:
  `I translate operational requirements into maintainable systems and take
  ownership across the delivery lifecycle.`
- Rename `Selected Product Work` to `Commercial Experience`.
- Rename `Core Technologies` to `Technologies`.
- Remove the `Earlier Experience` section.
- Move Freelance Web Development into `Professional Experience` as a separate
  entry.
- Keep Endless City, Flappy-Pixie, and Fitmed under `Selected Projects`.
- Keep the existing public-safe Xelto facts and confidentiality exclusions.

## Section Order

1. Header
2. Profile
3. Education
4. Professional Experience
5. Commercial Experience
6. Technologies
7. Selected Projects
8. Additional Information

Education moves near the top because it is short and provides useful context.
Technologies moves below the commercial work so the evidence of applied skills
appears before the keyword list.

## Visual Hierarchy

Preserve Times New Roman for the name and section headings and Calibri for body
content. Keep the black and muted-gray palette.

Create a distinct employer style for `Xelto`: muted Times New Roman, larger than
the body text. Keep job titles in bold Calibri at a smaller size. Align employer
and role dates to the right. Apply the same professional-entry structure to the
freelance role.

Reduce vertical spacing before headings and between entries. Keep body text at
or above 8.5 pt, keep the existing page width, and use margins no smaller than
0.4 inches. Condense commercial and personal project entries through spacing
and compact formatting before reducing font size.

## One-Page Fit Strategy

The header drops from five contact lines to three. The layout removes the page
break, separate earlier-experience heading, and project-link lines. Education
uses compact institution and qualification lines. Commercial entries retain
their titles, dates, technology labels, and descriptions with tighter spacing.

If the first render exceeds one page, adjust spacing in this order:

1. Reduce heading and entry spacing.
2. Reduce paragraph leading.
3. Shorten redundant project wording without removing verified facts.
4. Reduce body text to 8.5 pt.

Do not use a two-column layout or type smaller than 8.5 pt.

## Deliverables

Update and repackage:

- `Tomasz-Zielinski-Full-Stack-CV.docx`
- `Tomasz-Zielinski-Full-Stack-CV.pdf`
- the existing public-safe source bundle and manifest

## Verification

Automated checks must confirm:

- the DOCX and PDF each contain one page;
- the section order matches this specification;
- GitHub and LinkedIn header text and hyperlinks are absent;
- personal-project hyperlinks and `View project` text are absent;
- `Technologies` and `Commercial Experience` use the new names;
- no `Earlier Experience` heading remains;
- freelance work appears inside `Professional Experience`;
- Xelto uses a distinct employer style from job titles;
- required contact, employment, education, and project facts remain present;
- excluded client names and private metrics remain absent.

Render the DOCX and PDF to PNG, inspect the full page at 100 percent, and revise
until no text clips, overlaps, or becomes difficult to scan.
