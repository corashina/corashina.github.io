# Center Contact Flair Design

## Goal

Center the 208×58 Stack Exchange profile flair beneath the Contact links without changing its content, size, spacing, or markup.

## Design

- Keep the flair link as a block element.
- Preserve its existing top margin.
- Remove the relative-positioning and `left: 50%` offset.
- Center it within the shared content column using automatic horizontal margins.
- Make no changes to other Contact links or responsive layout behavior.

## Verification

- Add a focused stylesheet contract test for block display, the existing top margin, and automatic left/right margins.
- Confirm the obsolete positioning declarations are absent.
- Run the focused style test, full test suite, typecheck, and production build.
