---
title: "Generating a coordinate grid inside country borders"
description: "Bounding boxes, polygon tests, and the edge cases behind a small geographic sampling package."
date: "2019-09-10"
tags: [JavaScript, Geometry, GeoJSON]
draft: false
---

I built `points-in-country` to generate points inside a country's boundary. The public interface takes a country name and an optional interval, then returns coordinate pairs. A caller can use those points to place markers or sample a region without maintaining a separate country lookup.

The implementation is small: a bundled GeoJSON dataset, a bounding-box scan, and a point-in-polygon dependency. Most of the engineering questions concern the meaning of the input and output. Country borders can include islands and holes, and an interval measured in degrees does not describe equal distances across the globe.

The repository's development history runs from 6 to 10 September 2019. The article date follows the final GeoJSON update, rather than a later repository push timestamp.

## Reducing a border to candidate points

The function looks up a feature by its `ADMIN` property and rejects an unknown country. It defaults the interval to 0.1, extracts polygon coordinates, and calculates minimum and maximum values along each axis.

For each polygon ring, it walks a rectangular grid covering that bounding box. It passes each candidate to `robust-point-in-polygon` and keeps points classified as inside or on the boundary.

The resulting pipeline is:

```text
Country name
    -> matching GeoJSON feature
    -> polygon rings and their bounding boxes
    -> regularly spaced candidate coordinates
    -> point-in-polygon classification
    -> accepted coordinate pairs
```

The bounding box removes the need to scan the whole world. It still includes sea and neighbouring countries, so the polygon test remains necessary. A long, narrow region can reject a large proportion of its candidate points.

The [source](https://github.com/corashina/points-in-country/blob/de2595d7078bfffda984f63b5d96e7bd2744cefd/points-in-country.js) keeps the sampling loop separate from the geometric predicate by using the dependency for classification.

## Defining the coordinate contract

GeoJSON stores coordinate pairs in longitude, latitude order. The function swaps each pair while preparing its internal polygons, then swaps accepted points back on output. The return value therefore follows longitude, latitude order, despite the README labelling it latitude, longitude.

That mismatch is easy to overlook because both values are valid numbers. A caller can draw a plausible point in the wrong location without receiving an exception. The Latvia example exposes the distinction: a pair beginning near 26 and ending near 56 represents longitude followed by latitude.

For a reusable geometry function, an example is part of the API contract. It should agree with the actual output and with the conventions of the consuming map library. Descriptive internal names help too; the implementation's axis names do not consistently match the values after the swap.

## Islands and holes need different treatment

A GeoJSON Polygon contains an exterior ring and can contain interior rings representing holes. A MultiPolygon groups several polygons, each with that same structure.

The archived implementation treats a Polygon's first ring as its boundary and flattens MultiPolygon rings into a list. This can produce useful samples for simple shapes, but it loses the relationship between exterior rings and their holes. Sampling every ring as an independent filled region can include points that should have been excluded.

There is another consequence in the Polygon branch: it uses `shift()` on the coordinates loaded from the cached JSON module. That removes the exterior ring from the shared dataset. Calling the function again for the same feature can therefore see different geometry.

A revision would preserve the source coordinates, keep each polygon's exterior and holes together, and accept a point only when it belongs to the exterior and no hole. That is a change to the geometry handling; the published version does not implement it.

## Choosing an interval is a cost decision

For a bounding box of width `w` and height `h`, an interval `s` produces roughly `(w / s) * (h / s)` candidates. Halving the interval therefore creates about four times as many classification calls before accounting for boundary effects.

The interval is angular. It does not create a grid with uniform spacing in metres or equal area per point. That matters if a caller interprets the result as evenly distributed physical samples.

Input validation also affects termination. The function substitutes the default for falsy intervals but does not reject negative values. A negative increment moves a loop away from its upper bound. A production revision should require a finite positive interval and place an explicit limit on the requested work.

## Testing the contract as well as the counts

The [existing tests](https://github.com/corashina/points-in-country/blob/de2595d7078bfffda984f63b5d96e7bd2744cefd/test/test.js) assert point counts for selected countries and intervals. They include a tiny country sampled with a large interval, where an empty result is expected.

Those examples check specific dataset outputs. They do not cover repeated calls, holes, coordinate order, or invalid increments. Small synthetic polygons would make those cases easier to reason about than a full country boundary: a square, a square with a hole, and two separated islands provide known expectations.

This package demonstrates how a short implementation can expose a large contract. The loop is straightforward; the harder work is preserving geometry structure and making the meaning of each coordinate unambiguous.
