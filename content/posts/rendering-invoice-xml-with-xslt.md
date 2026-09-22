---
title: "Turning invoice XML into readable PDFs"
description: "Versioned invoice XML, conditional XSLT layouts, localization, and HTML-to-PDF checks with a .NET desktop tool."
date: "2023-08-21"
tags: [XSLT, .NET, E-invoicing]
draft: false
---

I worked on a rendering project that turns structured invoice XML into readable HTML and PDF. The input follows Polish KSeF invoice schemas. The output has to serve two readers: a recipient who wants the business document and an operator who may need schema and system details.

This work belongs in a separate case study from the [e-invoicing operations console](/blog/building-einvoicing-operations-console/). The console manages document workflows through a React UI. The rendering project focuses on deterministic XML transformation, layout, localization, and PDF behavior.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Two views from the same invoice

The project maintains two template families. The Simple family presents business content for an invoice recipient. The Enriched family adds technical metadata for an operator. Each family has a stable entry stylesheet and versioned common templates.

Both entry stylesheets accept parameters for the KSeF reference number and portal link, invoice date, QR images, language, logo, and template version. They define a European decimal format and a translation template. The main match handles two known FA3 namespace variants plus a fallback based on the element's local name.

```text
invoice XML
    + rendering parameters
    -> Simple or Enriched XSLT 1.0 template
    -> HTML
    -> optional wkhtmltopdf conversion
    -> PDF
```

The two families share a visual language without forcing one audience to read the other's fields. The Enriched view can show form code, schema version, generation timestamp, and source-system information. The Simple view spends that space on the invoice parties, dates, lines, tax summary, payment, transport, and correction data that a recipient needs.

Separate templates create some duplication. They also make omissions deliberate. Removing a technical field from a recipient document does not depend on CSS hiding it after rendering.

## Handling schema versions without freezing development

XML namespaces make schema evolution visible in every XPath. A template written for one namespace can stop matching when the authority publishes another version, even if many business fields keep the same local names.

The entry templates name two schema namespaces and match either one. Inside the transform, many selectors use `local-name()` for fields such as `Fa`, `FaWiersz`, `RodzajFaktury`, and party nodes. That gives the renderer tolerance across related namespace revisions.

This choice trades strictness for continuity. A local-name selector can match an element from an unexpected namespace. The stylesheet acts as a renderer, not a schema validator. A separate validation step should reject documents that do not conform to an accepted invoice schema before rendering.

Version history remains part of the design. Common Simple releases record changes such as table refactoring, new tax-summary rows, label corrections, font changes, advance-payment wording, and a conditional tax-amount column. Enriched releases track corresponding operator-view changes. Another template family covers a different invoice schema and document type.

The history shows why a renderer needs versions. A wording change may look cosmetic but can depend on invoice kind. A new column can alter page width, PDF scaling, and all later columns. Keeping prior files makes it possible to compare output or retain an older layout while a new version is reviewed.

## Building tables from the data that exists

Invoice lines do not all contain the same fields. One document may include product names, quantities, units, net prices, tax rates, and commodity codes. Another may add exchange rates or extra line descriptions. A correction can require before-and-after context that an ordinary invoice lacks.

The stylesheets derive their columns from the whole line collection. They test whether any `FaWiersz` contains a field before adding its header and cells. The Simple template includes conditional columns for fields such as item name, quantity, unit, price, tax rate, tax amount, currency rate, product index, CN, and GTU. The Enriched template adds more technical classifications.

That whole-table test prevents a common rendering bug. If the header tests the first line while later rows contain extra fields, cells shift under the wrong headings. The template uses one condition for the header and repeats the same condition for each row.

The stylesheet also links additional descriptions to a line number. It can render key-value details beneath the related item name. Number formatting uses the named European decimal format, while several tax-rate branches handle textual values and numeric percentages.

Conditional layout grows complex as a schema grows. XSLT 1.0 offers variables, named templates, loops, and branching, but no modern module system or strong type checker. A small business rule can affect the header, column widths, body cells, totals, and print layout. I found it useful to treat each visible change as a document-wide change rather than a one-line XPath edit.

## Localizing labels inside the transform

The templates receive a language parameter and route labels through a named translation template. The same transform can render Polish or English headings without a second pass over the HTML.

Localization reaches beyond static labels. Invoice kind controls the title, including ordinary, corrective, advance, settlement, and simplified forms. The label for one date changes for advance-payment invoices. Tax categories need readable names, and units or narrow table headings may need shorter translations to fit.

Keeping translations in XSLT has a practical benefit: the produced HTML is self-contained. A PDF converter does not need to run application JavaScript or call a translation service. The cost is editorial. Translators and developers work in a large technical file, and a label change requires another template version.

The templates also use a font suited to the required character set and PDF environment. Font metrics affect wrapping and pagination, so a font replacement belongs in visual regression work rather than a text-only review.

## Removing hidden network dependencies

Earlier template versions imported shared visualization stylesheets. Later common versions removed that import and added local stubs where the imported stylesheet had supplied named templates. The version log records the result as a self-contained template.

Self-contained transforms reduce two risks. A production render does not depend on a remote stylesheet remaining available, and a local test uses the same code that a service can load. One related template also removed an unused import because it triggered aggressive Smart Shrinking in wkhtmltopdf.

The project still includes a custom XML resolver in its desktop tester because older or development stylesheets may use imports or the XSLT `document()` function. The resolver checks the selected stylesheet directory first and can fall back to standard URL resolution.

Resolver behavior needs a security boundary. The tester creates the invoice XML reader with DTD processing prohibited and no XML resolver. That blocks external entity resolution in the input XML. It enables the XSLT document function for the stylesheet, so a production host should control which templates and resolver paths it accepts.

## Testing HTML and PDF in one desktop tool

The .NET 8 Windows Forms tester makes template work visible without running the full e-invoicing application. A developer selects an XML file and stylesheet, adds XSLT parameters, and chooses HTML or PDF output.

The tool loads the stylesheet into `XslCompiledTransform`, creates a hardened reader for the invoice XML, adds non-empty parameters to an `XsltArgumentList`, and writes UTF-8 HTML into memory. It can save that HTML for browser inspection.

For PDF output, the tester passes the HTML to a wkhtmltopdf wrapper. Controls expose color mode, orientation, paper size, margins, zoom, headers, and footers. It can generate unique file names and open the created artifacts after the run.

That harness shortens the layout loop:

```text
select representative XML
    -> choose template and language
    -> transform to HTML
    -> inspect structure and wrapping
    -> render PDF with target settings
    -> inspect pagination, width, and fonts
```

HTML alone cannot reveal all PDF behavior. wkhtmltopdf can shrink wide tables, choose different page breaks, or use font metrics that differ from a current browser. The version history contains fixes for column widths, header wrapping, font size, and Smart Shrinking, which shows the value of testing the final medium.

## Keeping template versions honest

The entry stylesheet, versioned filename, README table, and version log can each carry a version number. One machine-readable manifest could hold the family, schema, version, date, and entry path. A small verification script could then confirm that each entry stylesheet's `TemplateVersion` matches its current versioned file.

## Where XSLT fits

XSLT owns presentation in this project. Schema and tax validation, invoice submission, and KSeF session management belong to separate parts of a full invoicing system. Rendering a field shows that the XML contains it and the template matched it; it does not establish that the value is correct.

Within that boundary, XSLT remains a strong fit. XPath expresses optional XML structure with precision, named templates reuse formatting rules, and the output stays deterministic for a given input and parameter set. The .NET harness covers the last mile from XML through HTML to the PDF engine that users see.

The hardest part was maintaining the relationship between business rules and page geometry. An optional field changes a table. A translated label changes its width. A schema revision changes matching. Versioned templates, representative fixtures, and PDF inspection keep those effects visible while the invoice format evolves.
