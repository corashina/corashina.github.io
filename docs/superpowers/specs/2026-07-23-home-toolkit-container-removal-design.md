# Home Toolkit Container Removal Design

**Date:** 2026-07-23

## Goal

Remove the grey toolkit-group containers while preserving the improved group layout, headings, and pills.

## Scope

Change only `src/styles/home.module.scss` and `src/styles/contrast.test.ts`. Keep the Home content, semantic markup, toolkit data, other Home styles, and every other website section unchanged.

## Styling

Remove these declarations from `.toolkitGroup`:

- `background`
- `border`
- `border-radius`
- `padding`

Keep `.toolkitGroup` as a grid with a `0.5rem` gap between its heading and pill list.

Keep the existing:

- Toolkit heading
- accent line and uppercase group headings
- outlined pills and accent hover state
- `1rem` toolkit grid gap
- one-column mobile group layout
- two-column desktop group layout from `768px`

## Testing

Update the Home stylesheet contract so it requires `.toolkitGroup` to retain `display: grid` and `gap: 0.5rem` while rejecting `background`, `border`, `border-radius`, and `padding`.

Run the full test, typecheck, and production build workflow. Check desktop and `390px` layouts in dark and light themes. Confirm that the groups remain readable and aligned, all pills remain visible, and the page has no horizontal overflow.
