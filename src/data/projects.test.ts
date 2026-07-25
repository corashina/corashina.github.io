import { describe, expect, it } from "vitest";
import { getProjectBySlug, projects } from "./projects";

const expectedProjects = [
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["javascript", "three.js", "webgl"], "2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/WebGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["javascript", "three.js", "webgl", "gltf"], "2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/Endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["javascript", "three.js", "webgl"], "2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/Flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["javascript", "three.js", "webgl"], "2018", "/portfolio/civio.mp4", "https://github.com/corashina/Civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["typescript", "three.js", "webgl", "glsl"], "2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/Particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype system for dieteticians", ["javascript", "react", "redux", "node", "express", "mongodb"], "2018", "/portfolio/fitmed.png", "https://github.com/corashina/Fitmed"],
  ["kiteprint", "Kiteprint", "Simple PSD to HTML", ["javscript", "react"], "2018", "/portfolio/kiteprint.png", "https://github.com/corashina/Kiteprint"],
  ["xelcode", "Xelcode", "Scanner-driven warehouse and manufacturing workflows integrated with Oracle JD Edwards E1.", ["react", "typescript", "javascript", "i18next", "oracle jd edwards"], "2021–2026", "/portfolio/xelcode.mp4", "https://xelcode.com/product/"],
  ["icr", "Doc AI", "Document-AI interfaces for PDF handling, prompt configuration, analysis, and structured results.", ["react", "typescript", "pdf", "document ai"], "2024–2026", "/portfolio/doc_ai.mp4", "https://xelto.ai/en/live-demo"],
  ["workflow", "Workflow", "Approval and operational workflow modules for business-process handling.", ["react", "typescript", "rest api"], "2024–2026", "/portfolio/workflow.mp4", "https://xelto.ai/en/live-demo"],
  ["holiday", "Holiday", "Employee leave administration workflows.", ["react", "typescript"], "2024–2026", "/portfolio/holiday.mp4", "https://xelto.ai/en/live-demo"],
  ["einvoicing", "eInvoicing", "E-invoicing interfaces for integration rules, document and log views, and PDF/XML workflows.", ["react", "typescript", "pdf", "xml"], "2024–2026", "/portfolio/eInvoicing.mp4", "https://xelto.ai/en/live-demo"],
  ["xelapps", "XELapps", "Client and application setup modules for the Xelto platform.", ["react", "typescript", "rest api", "jwt"], "2024–2026", "/portfolio/xelapps.mp4", "https://xelto.ai/en/live-demo"],
  ["cosmic-sugar", "Cosmic Sugar", "Interactive Three.js particle simulation with sculptable push and pull forces.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/cosmic-sugar.mp4", "https://github.com/corashina/cosmic-sugar"],
  ["dont-sleep-with-the-fishes", "Don't Sleep With The Fishes", "Desktop-browser survival game about scavenging a sinking ship and managing a lifeboat while waiting for rescue.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/dont-sleep-with-the-fishes.mp4", "https://github.com/corashina/dont-sleep-with-the-fishes"],
] as const;

describe("projects", () => {
  it("matches the project dataset in display order", () => {
    expect(projects.map((project) => [
      project.slug,
      project.title,
      project.description,
      project.tools,
      project.date,
      project.media.src,
      project.sourceUrl,
    ])).toEqual([
      expectedProjects[12],
      expectedProjects[13],
      expectedProjects[14],
      expectedProjects[8],
      expectedProjects[9],
      expectedProjects[10],
      expectedProjects[11],
      expectedProjects[7],
      expectedProjects[4],
      expectedProjects[3],
      expectedProjects[2],
      expectedProjects[1],
      expectedProjects[6],
      expectedProjects[5],
      expectedProjects[0],
    ]);
  });

  it("looks up projects by slug", () => {
    expect(getProjectBySlug("civio")?.title).toBe("Civio");
    expect(getProjectBySlug("missing")).toBeUndefined();
  });

  it("derives exact poster paths for video media", () => {
    expect(getProjectBySlug("xelapps")?.media).toEqual({
      kind: "video",
      src: "/portfolio/xelapps.mp4",
      posterSrc: "/portfolio/xelapps.webp",
      alt: "XELapps configuration interface",
    });
    expect(getProjectBySlug("einvoicing")?.media).toEqual({
      kind: "video",
      src: "/portfolio/eInvoicing.mp4",
      posterSrc: "/portfolio/eInvoicing.webp",
      alt: "eInvoicing integration interface",
    });
  });

  it.each([
    ["xelcode", "Xelcode", "/portfolio/xelcode.mp4", "https://xelcode.com/product/"],
    ["icr", "Doc AI", "/portfolio/doc_ai.mp4", "https://xelto.ai/en/live-demo"],
    ["workflow", "Workflow", "/portfolio/workflow.mp4", "https://xelto.ai/en/live-demo"],
    ["holiday", "Holiday", "/portfolio/holiday.mp4", "https://xelto.ai/en/live-demo"],
    ["einvoicing", "eInvoicing", "/portfolio/eInvoicing.mp4", "https://xelto.ai/en/live-demo"],
    ["xelapps", "XELapps", "/portfolio/xelapps.mp4", "https://xelto.ai/en/live-demo"],
  ])("adds the public-safe %s project record", (slug, title, mediaSrc, sourceUrl) => {
    expect(getProjectBySlug(slug)).toMatchObject({
      media: { kind: "video", src: mediaSrc },
      sourceLabel: "Product overview →",
      sourceUrl,
      title,
    });
  });

  it("categorizes projects and lists them newest first", () => {
    expect(projects.map((project) => project.slug)).toEqual([
      "xelapps",
      "cosmic-sugar",
      "dont-sleep-with-the-fishes",
      "icr",
      "workflow",
      "holiday",
      "einvoicing",
      "xelcode",
      "particle-simulation",
      "civio",
      "flappy-pixie",
      "endless-city",
      "kiteprint",
      "fitmed",
      "webgl-minecraft",
    ]);
    expect(getProjectBySlug("administration")).toBeUndefined();
    expect(getProjectBySlug("ksef")).toBeUndefined();
    expect(getProjectBySlug("xelapps")?.category).toBe("commercial");
    expect(getProjectBySlug("kiteprint")?.category).toBe("freelance");
    expect(getProjectBySlug("fitmed")?.category).toBe("freelance");
    expect(getProjectBySlug("particle-simulation")?.category).toBe("experiments");
    expect(getProjectBySlug("cosmic-sugar")?.category).toBe("experiments");
    expect(getProjectBySlug("dont-sleep-with-the-fishes")?.category).toBe("experiments");
    expect(getProjectBySlug("xelcode")).toMatchObject({ startedAt: "2021", startedLabel: "2021" });
    expect(getProjectBySlug("icr")).toMatchObject({ startedAt: "2025", startedLabel: "2025" });
    expect(getProjectBySlug("workflow")).toMatchObject({ startedAt: "2024", startedLabel: "2024" });
    expect(getProjectBySlug("xelapps")).toMatchObject({ startedAt: "2026", startedLabel: "2026" });
    expect(getProjectBySlug("webgl-minecraft")).toMatchObject({
      startedAt: "2018-04",
      startedLabel: "2018",
    });
    expect(projects.every((project) => /^\d{4}$/.test(project.startedLabel))).toBe(true);
  });
});
