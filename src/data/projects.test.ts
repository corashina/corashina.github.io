import { describe, expect, it } from "vitest";
import { getProjectBySlug, projects } from "./projects";

const expectedProjects = [
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["javascript", "three.js", "webgl"], "April 2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/WebGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["javascript", "three.js", "webgl", "gltf"], "September 2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/Endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["javascript", "three.js", "webgl"], "October 2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/Flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["javascript", "three.js", "webgl"], "December 2018", "/portfolio/civio.mp4", "https://github.com/corashina/Civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["typescript", "three.js", "webgl", "glsl"], "February 2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/Particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype system for dieteticians", ["javascript", "react", "redux", "node", "express", "mongodb"], "July 2018", "/portfolio/fitmed.png", "https://github.com/corashina/Fitmed"],
  ["kiteprint", "Kiteprint", "Simple PSD to HTML", ["javscript", "react"], "September 2018", "/portfolio/kiteprint.png", "https://github.com/corashina/Kiteprint"],
] as const;

describe("projects", () => {
  it("matches the original project dataset verbatim and in order", () => {
    expect(projects.map((project) => [
      project.slug,
      project.title,
      project.description,
      project.tools,
      project.date,
      project.media.src,
      project.sourceUrl,
    ])).toEqual(expectedProjects);
  });

  it("looks up projects by slug", () => {
    expect(getProjectBySlug("civio")?.title).toBe("Civio");
    expect(getProjectBySlug("missing")).toBeUndefined();
  });
});
