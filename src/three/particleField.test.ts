import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createParticleField } from "./particleField";

describe("particle render field", () => {
  it("disposes each geometry and material once", () => {
    const field = createParticleField("high");
    const resources = field.group.children.flatMap((child) => {
      const renderable = child as THREE.Points | THREE.Mesh | THREE.LineSegments;
      return [renderable.geometry, renderable.material];
    }) as Array<{ dispose(): void }>;
    const spies = resources.map((resource) => vi.spyOn(resource, "dispose"));

    field.dispose();
    field.dispose();

    expect(field.group.children).toHaveLength(0);
    spies.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
  });
});
