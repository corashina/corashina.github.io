---
title: "Building an editable voxel world in the browser"
description: "Chunk generation, raycast block editing, and collision handling in an early Three.js terrain prototype."
date: "2018-09-08"
tags: [Three.js, WebGL, Game development]
draft: false
---

I built WebGL Minecraft to explore a small set of first-person interactions: walk around a block world, jump, remove a block, choose a material, and place another block against a surface. The project uses Three.js, pointer-lock controls, and simplex noise.

The terrain work reached its last implementation commit on 8 September 2018. Later changes added licensing and presentation material. This article follows the terrain prototype, including the limits of its rendering and collision approach.

## Loading terrain around the player

Each chunk contains a 10 by 10 horizontal grid. Blocks are 10 world units wide, so a chunk spans 100 units. The update loop derives the player's chunk coordinates by dividing their world position by 100 and taking the floor.

Crossing a chunk boundary triggers a check of the surrounding three-by-three neighbourhood. The code records loaded chunk coordinates as strings and generates any missing entries.

This keeps generation tied to movement instead of rebuilding the neighbourhood each frame. Flooring also gives meaningful chunk coordinates on the negative side of the origin, where truncation toward zero would put nearby negative positions into the wrong cell.

The implementation retains loaded chunks. It does not unload distant geometry, and each block has its own mesh and geometry. Walking farther therefore increases memory use, draw work, and the number of objects available to raycasts. The fog limits visibility, but does not remove those objects from storage.

The [main source file](https://github.com/corashina/WebGL-Minecraft/blob/05357d8a5f204e2a2747fc8e5b5d5b213ab44222/js/main.js) keeps generation, interaction, and movement together, making the prototype's data flow easy to follow.

## Sampling a height for each column

The generator samples simplex noise and turns the result into a block height. In this version it creates one surface block per horizontal position, rather than a filled column of underground blocks.

The noise input includes `Math.random()`, and local sampling offsets restart inside each chunk generation call. As a result, this is not a seeded world that can regenerate a location from its global coordinates. Retaining loaded meshes also retains the terrain that was generated for those locations.

A deterministic revision would sample from global coordinates and a world seed. It could then rebuild distant chunks while storing only player edits. That would separate procedural base terrain from mutable world state, a distinction absent from the prototype.

## Turning a raycast hit into a block position

Removing a block starts with the closest raycast intersection within the interaction distance. The code removes the selected mesh from the scene and from the arrays used for selection and collision.

Placement needs an extra step. The hit point lies on an existing face, so the code adds the face normal before snapping to the block grid:

```javascript
block.position.copy(voxel.point).add(voxel.face.normal);
block.position
  .divideScalar(BLOCK_SIZE)
  .floor()
  .multiplyScalar(BLOCK_SIZE)
  .addScalar(BLOCK_SIZE / 2);
```

The small offset selects the adjacent cell. Division and flooring identify that cell, and adding half a block positions the new mesh at its centre. The same grid convention is used for the translucent placement preview.

In this world the blocks are axis-aligned, so a face normal is enough to choose the placement side. A version with transformed block meshes would need to account for the normal's coordinate space.

The prototype keeps its scene and interaction lists in sync by updating each one during an edit. A dedicated voxel store would give those operations one authoritative representation and make occupied-cell checks independent of rendered meshes.

## Combining movement with collision checks

The movement loop applies directional input, drag, and gravity to velocity, then translates the pointer-lock controller. A downward ray detects support beneath the player and permits jumping.

For side collisions, the code positions a box around the player and casts rays toward its vertices. A nearby intersection triggers a correction along the horizontal axis with the larger separation from the collided block's centre.

This provides a compact way to experiment with contact, but it is not a swept collision solver. A large movement between frames can pass through a surface before the final-position rays detect it. Repeated raycasts against the growing mesh list also make exploration more expensive.

A grid-aware controller could query nearby occupied cells and resolve movement against their boxes. That would use the world's structure to limit collision candidates, rather than asking the renderer's object list to serve as the spatial database.

## Separating a world from its meshes

The prototype uses render objects for several responsibilities: visible terrain, selection targets, collision candidates, and the record of placed blocks. That makes an early version quick to inspect, because selecting an object gives direct access to the thing to remove.

The same arrangement makes chunk unloading and rebuilding harder. A chunk mesh generated from voxel data could omit hidden faces and combine many blocks into fewer draw calls. The voxel data would remain available for collision and editing even when the mesh was absent.

Those optimizations are proposals, not features of the archived project. The implementation demonstrates the complete interaction from pointer input to an edited scene. It also shows the point at which an editable world needs its own data model instead of treating the collection of meshes as the world itself.
