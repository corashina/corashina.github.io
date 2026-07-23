# Home Toolkit Card Design

**Date:** 2026-07-23

## Goal

Improve the Home toolkit's contrast, spacing, and hierarchy while keeping it compact and consistent with the site's restrained visual style.

## Scope

Change only the Home toolkit styling and its stylesheet contract test. Keep the toolkit content, semantic HTML, introduction, navigation, Work section, Contact section, and shared theme values unchanged.

## Layout

The toolkit remains below the Home description.

Below the `768px` breakpoint, the four groups form one column in this order:

1. Languages
2. Platforms
3. Systems
4. Delivery

At `768px` and above, the groups form a two-column, two-row grid. Both columns have equal width. Each group fills its grid column and sizes vertically to its content.

The Toolkit heading spans the full grid width. The group grid uses a `1rem` gap.

## Group Panels

Each toolkit group uses a compact panel with:

- `color-mix(in srgb, $color-bg 92%, $color-1)` as its background
- a `1px solid $color-25` border
- a `0.75rem` corner radius
- `0.85rem` internal padding
- `0.5rem` between the heading and pills

The panel must remain distinct from the page in both dark and light themes without competing with the introduction.

Group headings use a `0.78rem` uppercase label with `0.08em` letter spacing. A `1.25rem` by `2px` `$color-3` line appears before each heading. The four groups use the same treatment.

## Pills

Pills keep their natural content width and wrap within each group.

Each pill uses:

- `$color-bg` against the panel background
- a `1px solid $color-2` border
- `$color-1` text
- `0.25rem 0.65rem` padding
- `inline-flex` alignment and a `1.35` line height

All tools keep equal visual weight. The design does not highlight selected technologies.

Pills wrap with a `0.4rem` gap. On hover, a pill uses `$color-3` for its background and border, with `$color-bg` for its text. Hover does not move or scale the pill.

## Responsive Behaviour

Long labels such as `React Native/Expo`, `Oracle JD Edwards`, and `Three.js/WebGL` stay on one line when space permits and wrap with the other pills when needed. The toolkit must not cause horizontal page overflow.

## Accessibility

The existing `aside`, headings, lists, and list items remain unchanged. The dark and light theme treatments must provide clear pill boundaries and readable text. The hover treatment cannot be the only cue that an item exists.

## Testing

Extend the Home stylesheet contract to cover:

- the one-column mobile group grid
- the two-column desktop group grid
- the panel background, border, radius, and padding
- the group heading label and accent treatment
- the pill background, border, text, and padding
- the accent hover background, border, and contrasting text

Run the full test, typecheck, and production build workflow. Perform visual checks in dark and light themes at desktop and mobile widths. Confirm that all four groups remain visible and that the page has no horizontal overflow.
