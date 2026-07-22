# Work Project Order and Start Dates Design

## Goal

Place the eight Xelto projects before personal projects in the Work grid and show a start timestamp on every project card and detail page.

## Data Model

Replace the presentation-only project date with one start-date field per project. The value uses an ISO-compatible partial date (`YYYY-MM` when the known month is available, `YYYY` otherwise) plus a human-readable label. The UI renders the label through a semantic HTML `time` element.

## Display

Cards show the project title followed by `Started: <date>`. Detail pages show the same start timestamp under the project title. The date comes from the shared project data, so the card and detail view cannot diverge.

## Order and Date Precision

The Work data lists Xelto projects first, in this order: Xelcode, ICR, Workflow, Holiday, Administration, eInvoicing, KSeF, and XELapps. Personal projects retain their existing order after them.

- Existing personal projects retain their recorded month/year start dates.
- Xelcode: 2021.
- Workflow, Holiday, Administration, eInvoicing: 2024.
- ICR, KSeF: 2025.
- XELapps: 2026.

No private project receives an invented month or day.

## Validation

- Project-data tests assert ordering and every machine-readable/display start date.
- Work-page tests assert card order and rendered timestamps.
- Project-page tests assert the semantic start timestamp.
- Run the root-project test suite and production build.
