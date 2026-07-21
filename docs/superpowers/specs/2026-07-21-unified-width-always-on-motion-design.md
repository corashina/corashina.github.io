# Unified Width and Always-On Motion Design

## Goal

Keep the portfolio shell visually stable during route transitions and make the intended animated experience the default without URL parameters.

## Layout

- The shared application shell uses a `900px` maximum width on every route.
- Home, Work, project detail, Contact, and not-found routes inherit the same shell width.
- The shell remains fluid below `900px`, preserving the existing horizontal padding and responsive grids.
- Route changes no longer add or remove a Work-specific width class, so slide/fade transitions never coincide with an instantaneous width change.

## Motion

- Particle motion and pointer interaction are enabled by default.
- The `?motion=full` development override and its parsing logic are removed.
- Route slide/fade transitions always use their existing 500ms directional timing.
- Project media reveal transitions remain enabled.
- The site no longer changes these behaviors in response to `prefers-reduced-motion`.

## Project Video Playback

- Video tiles play when their project link receives pointer hover or keyboard focus.
- Videos pause and reset to time zero when the link loses hover or focus.
- Playback attempts continue to handle rejected `play()` promises without surfacing an error.
- Image tiles and project-detail media behavior remain unchanged.

## Testing

- Style tests require a single `900px` shell width and no Work-only width override.
- Component tests require route motion without a query parameter and confirm that no URL motion override is needed.
- Project tests require video play on hover/focus even when the environment reports reduced motion, plus pause/reset on leave/blur.
- Tests assert that motion-override parsing and reduced-motion suppression rules are absent.
- The full test, typecheck, and production build commands must pass.
