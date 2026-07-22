# Work card video and date design

## Scope

Update the Work listing and project data without changing the existing project-detail route structure.

## Card layout

Each card retains its media area and becomes a two-part layout below it: project title on the left and the start date on the right, on one line. The date is rendered as a semantic `time` element, but displays only its value; the `Started:` label is removed. The detail page also displays the semantic date without that label.

## Project collection

Remove the Administration and KSeF records from project data, start-date metadata, media alt text, ordering metadata, and tests. Keep the remaining Xelto projects at the beginning of the Work listing.

## Video media

Move these supplied videos from `C:\Users\Tomasz\Downloads\videos` into `static/portfolio` and render them through the existing media component:

- `xelcode.mp4` for Xelcode
- `doc_ai.mp4` for ICR
- `workflow.mp4` for Workflow and Holiday
- `eInvoicing.mp4` for eInvoicing
- `xelapps.mp4` for XELapps

Replace the matching placeholder/PNG media references with those video paths and update their accessible alt text to describe the video content. No new media behavior is required because the existing `ProjectMedia` component already supports video thumbnails.

## Testing

Tests will assert the reduced Xelto project list and its order, the video media assignment, the single-line card header containing title and date without `Started:`, and the unprefixed detail-page timestamp.
