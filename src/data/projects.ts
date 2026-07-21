export type ProjectMedia = {
  kind: "image" | "video";
  src: string;
  alt: string;
};

export type Project = {
  slug: string;
  title: string;
  description: string;
  tools: readonly string[];
  date: string;
  media: ProjectMedia;
  sourceUrl: string;
};

const projectData = [
  [
    "webgl-minecraft",
    "WebGL-Minecraft",
    "Primitive minecraft clone made with three.js",
    ["javascript", "three.js", "webgl"],
    "April 2018",
    "/portfolio/webgl-minecraft.mp4",
    "https://github.com/corashina/WebGL-Minecraft",
  ],
  [
    "endless-city",
    "Endless-City",
    "Infinite WebGL scene heavily inspired by littleworkshop.fr",
    ["javascript", "three.js", "webgl", "gltf"],
    "September 2018",
    "/portfolio/endless-city.mp4",
    "https://github.com/corashina/Endless-City",
  ],
  [
    "flappy-pixie",
    "Flappy-Pixie",
    "Flappy Bird clone made in one week for an interview challenge",
    ["javascript", "three.js", "webgl"],
    "October 2018",
    "/portfolio/flappy-pixie.mp4",
    "https://github.com/corashina/Flappy-Pixie",
  ],
  [
    "civio",
    "Civio",
    "Hexagonal map generation using simplex noise",
    ["javascript", "three.js", "webgl"],
    "December 2018",
    "/portfolio/civio.mp4",
    "https://github.com/corashina/Civio",
  ],
  [
    "particle-simulation",
    "Particle Simulation",
    "Particle generator made with GLSL",
    ["typescript", "three.js", "webgl", "glsl"],
    "February 2019",
    "/portfolio/particle-simulation.mp4",
    "https://github.com/corashina/Particle-Simulation",
  ],
  [
    "fitmed",
    "Fitmed",
    "Prototype system for dieteticians",
    ["javascript", "react", "redux", "node", "express", "mongodb"],
    "July 2018",
    "/portfolio/fitmed.png",
    "https://github.com/corashina/Fitmed",
  ],
  [
    "kiteprint",
    "Kiteprint",
    "Simple PSD to HTML",
    ["javscript", "react"],
    "September 2018",
    "/portfolio/kiteprint.png",
    "https://github.com/corashina/Kiteprint",
  ],
] as const;

const projectMediaAlt: Record<string, string> = {
  "webgl-minecraft": "WebGL Minecraft scene",
  "endless-city": "Infinite procedural WebGL city scene",
  "flappy-pixie": "Flappy Pixie game",
  civio: "Procedural hexagonal map",
  "particle-simulation": "GLSL particle simulation",
  fitmed: "Fitmed interface",
  kiteprint: "Kiteprint interface",
};

export const projects: readonly Project[] = projectData.map(
  ([slug, title, description, tools, date, src, sourceUrl]) => ({
    slug,
    title,
    description,
    tools,
    date,
    media: {
      kind: src.endsWith(".mp4") ? "video" : "image",
      src,
      alt: projectMediaAlt[slug],
    },
    sourceUrl,
  }),
);

export const getProjectBySlug = (slug: string): Project | undefined =>
  projects.find((project) => project.slug === slug);
