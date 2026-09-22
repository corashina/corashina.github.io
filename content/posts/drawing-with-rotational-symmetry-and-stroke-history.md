---
title: "Drawing with rotational symmetry and editable stroke history"
description: "Representing strokes once, repeating them through transforms, and preserving drawing state in a Java Swing application."
date: "2018-06-23"
tags: [Java, Graphics, Interaction]
draft: false
---

Digital Doily repeats a drawn stroke around the centre of a canvas. A curve made with the mouse can become a radial pattern, and reflection adds a mirrored copy within each sector. The user can change the number of sectors, choose a colour and pen width, undo strokes, and save previews into a gallery.

I built it in Java with Swing and `Graphics2D`. Despite the repository's short description mentioning a Mandelbrot generator, the implementation is a symmetry drawing tool. It stores mouse-drawn strokes and reproduces them through transforms.

Most of the drawing implementation dates to April 2018. The article date follows the last code changes on 23 June, which adjusted the window and controls.

## Storing one stroke and drawing it several times

The canvas stores a list of completed `Line` objects and one current line. A line contains its points, colour, pen width, and reflection setting. Mouse movement adds points to the current line; releasing the mouse adds that line to the completed list and starts another.

The drawing code translates the graphics origin to the centre of the canvas. For each sector, it draws the same sequence of points and rotates the graphics context by the sector angle:

```text
sector angle = 360 degrees / number of sectors

draw the stored stroke
rotate by one sector angle
repeat until the full circle is covered
```

Reflection negates the horizontal coordinate while retaining the vertical coordinate. This produces a mirror of the stroke before the next rotation.

The representation stores one set of input points regardless of the number of repetitions. Drawing cost still grows with the number of sectors and points, but storage does not need a separate transformed copy for each sector. The [canvas](https://github.com/corashina/Digital-Doily/blob/37846d771f11856d456727201baf720265ad7574/Canvas.java) and [line renderer](https://github.com/corashina/Digital-Doily/blob/37846d771f11856d456727201baf720265ad7574/Line.java) contain the input and transform paths.

## Deciding which settings belong to a stroke

Colour, width, and reflection are stored on the line. Changing the active colour should affect the current drawing tool without recolouring completed strokes.

The number of sectors belongs to the canvas. A line asks the canvas for its current sector count and angle during rendering. Changing that count therefore changes the repetition of existing strokes as well as future ones.

That split creates two different editing behaviours. A brush setting becomes part of a stroke's history, while symmetry remains a live property of the composition. It lets the user try several radial arrangements without redrawing the source curves.

The mouse-coordinate conversion also depends on whether the sector count is odd or even. It preserves the prototype's intended orientation for those cases, but makes changing sector count another reason to test coordinate conventions. A renderer should have an explicit rule for the coordinate space in which stored points live.

## Repainting from the model

Swing can request a repaint after exposure, resizing, or an interaction. The canvas redraws the stored lines in `paintComponent`, followed by the current line and optional sector guides. The drawing remains reconstructible from the model instead of existing only as pixels left behind by mouse events.

Each line performs a complete sequence of sector rotations. In theory that returns the graphics transform to its starting orientation. A more isolated implementation would draw through a copied graphics context or save and restore the transform, so a change in one drawing routine could not affect the next.

The distinction becomes useful as rendering grows. Sector guides, selections, and strokes can each have their own transform without depending on the previous routine to leave shared state untouched.

## Undoing a gesture rather than a mouse sample

Undo moves the most recent completed line into a second list. Redo moves the most recent removed line back. The unit of history is the whole stroke, matching the gesture that created it.

This gives a compact history model. It also needs a rule for branching: after undoing a stroke and drawing a different one, should the old redo history remain available? The archived implementation leaves the removed-line list intact, so it can restore a stroke from the previous branch.

Clear removes the visible line list without creating an undoable command. A command-based history could make clearing, drawing, and other edits follow one policy. That would be a broader editing model than the two lists used here.

The eraser has a related design choice. It draws in the background colour rather than deleting points from earlier strokes. Since those eraser strokes remain in drawing order, undo can remove them like another stroke. Changing the background or introducing transparency would require a different compositing rule.

## Capturing previews without saving editable documents

The Save control paints the canvas into a `BufferedImage`, scales a preview, and adds it to the gallery. The gallery limits the number of saved previews to twelve and supports selecting and removing them.

These are in-memory raster snapshots. The code does not save an editable drawing document to disk. A durable document format would need the original points, per-stroke settings, and canvas symmetry settings, plus a versioned interpretation of that data.

The [controls](https://github.com/corashina/Digital-Doily/blob/37846d771f11856d456727201baf720265ad7574/Buttons.java) show how the image capture differs from the stroke model. A preview preserves what the canvas looked like; the model preserves the information needed to change it.

The application gets much of its flexibility from that small model. One stroke can be repainted at different symmetry settings, removed as a unit, or combined with later strokes. The remaining design decisions concern how much of that editing history and structure should survive beyond the current session.
