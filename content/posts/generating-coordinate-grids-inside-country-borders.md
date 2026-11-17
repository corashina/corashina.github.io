---
title: "Generating a coordinate grid inside country borders"
description: "Bounding boxes, robust polygon tests, and per-island scanning in a small npm package that turns a country name into a coordinate grid."
date: "2019-09-10"
tags: [JavaScript, Geometry, GeoJSON]
draft: false
---

I built `points-in-country` to answer a simple question: which coordinates fall inside a given country? It takes a country name and an optional grid interval, and returns every grid point inside that country's border. The package bundles boundaries for 206 countries and territories, so a caller doesn't need a GIS stack or a separate lookup service to place markers or sample a region.

It was published to npm in September 2019. The implementation is short, and most of the design work went into deciding what the input and output should mean.

## Using it

The whole API is one function:

```javascript
const pointsInCountry = require('points-in-country')

const points = pointsInCountry('Latvia', 0.1)
// [
//   [26.26859785200015, 55.76699086600011],
//   [26.36859785200015, 55.76699086600011],
//   [26.46859785200015, 55.76699086600011],
//   ...
// ]
```

The interval defaults to 0.1 degrees. An unknown country name throws instead of quietly returning an empty array, so a typo doesn't look like an empty country.

## From a border to a set of points

The pipeline has four steps:

```text
Country name
    -> matching GeoJSON feature
    -> polygon rings and their bounding boxes
    -> regularly spaced candidate coordinates
    -> point-in-polygon classification
    -> accepted coordinate pairs
```

The function finds the feature by its `ADMIN` name in the bundled GeoJSON. For each polygon ring it works out the minimum and maximum on each axis, walks a regular grid across that bounding box, and keeps the candidates that fall inside.

The classification uses `robust-point-in-polygon`. Testing whether a point is inside a polygon is easy to write and easy to get subtly wrong. Floating-point error near an edge can flip the answer, and points exactly on the border need a defined result. The library handles both cases and reports inside, outside or on the boundary as separate values. The package keeps points that are inside or on the border. Keeping the sampling loop separate from the geometric predicate also made each part easier to check on its own.

You can read the [whole implementation](https://github.com/corashina/points-in-country/blob/de2595d7078bfffda984f63b5d96e7bd2744cefd/points-in-country.js) in under a minute.

## Scanning islands one at a time

Countries such as Indonesia, Greece or the Philippines are a GeoJSON `MultiPolygon`: many separate shapes under one name. A single bounding box around the whole country would be mostly sea, and every sea point would still need a polygon test.

So the scan works per ring. Each island gets its own small bounding box, and the grid only covers that box. For an archipelago this cuts the number of candidate points sharply. The polygon test then only has to reject the corners of each island's box, not hundreds of kilometres of open water.

## Choosing an interval is a cost decision

For a bounding box of width `w` and height `h`, an interval `s` produces roughly `(w / s) * (h / s)` candidates. Halving the interval roughly quadruples the work. A country-wide grid at 0.01 degrees costs about a hundred times as much as one at 0.1.

The interval is measured in degrees, which suits the package's main use: spreading markers across a country on a map. It doesn't give equal spacing in metres. One degree of longitude spans about 111 km at the equator and about 61 km in Latvia, so a degree grid gets denser as you move away from the equator. The README documents a related edge case: an interval larger than a small country, such as the Vatican at 1 degree, returns an empty array.

## Testing against real borders

The [test suite](https://github.com/corashina/points-in-country/blob/de2595d7078bfffda984f63b5d96e7bd2744cefd/test/test.js) checks point counts for chosen countries and intervals, plus the tiny-country case where an empty result is correct.

## What a second version would add

The package does one job and keeps a small surface. If I extended it, I would:

- Treat polygon holes explicitly, so enclaves such as Lesotho inside South Africa are excluded from the surrounding country.
- Offer an optional spacing in metres for callers who need physically even samples rather than an even map grid.
- Validate the interval as a finite positive number and cap the number of candidates a single call may generate.
- Add small synthetic shapes to the tests, such as a square, a square with a hole and two separate islands, so each geometric rule has an exact expected answer.

The project shows how far a short function can go when the contract is clear. One call takes you from a country name to usable coordinates. Most of the engineering was in defining what a point, an interval and a border should mean.
