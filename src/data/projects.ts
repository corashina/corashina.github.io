export type ProjectMedia =
  | { kind: "image"; src: string; alt: string }
  | { kind: "video"; src: string; posterSrc: string; alt: string };

export type ProjectCategory = "commercial" | "freelance" | "experiments";

export type Project = {
  slug: string;
  title: string;
  description: string;
  tools: readonly string[];
  date: string;
  startedAt: string;
  startedLabel: string;
  category: ProjectCategory;
  media: ProjectMedia;
  sourceUrl: string;
  sourceLabel: string;
};

const projectData = [
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["javascript", "three.js", "webgl"], "2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/WebGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["javascript", "three.js", "webgl", "gltf"], "2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/Endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["javascript", "three.js", "webgl"], "2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/Flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["javascript", "three.js", "webgl"], "2018", "/portfolio/civio.mp4", "https://github.com/corashina/Civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["typescript", "three.js", "webgl", "glsl"], "2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/Particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype system for dieteticians", ["javascript", "react", "redux", "node", "express", "mongodb"], "2018", "/portfolio/fitmed.png", "https://github.com/corashina/Fitmed"],
  ["kiteprint", "Kiteprint", "Simple PSD to HTML", ["javscript", "react"], "2018", "/portfolio/kiteprint.png", "https://github.com/corashina/Kiteprint"],
  ["xelcode", "Xelcode", "Scanner-driven warehouse and manufacturing workflows integrated with Oracle JD Edwards E1.", ["react", "typescript", "javascript", "i18next", "oracle jd edwards"], "2021–2026", "/portfolio/xelcode.mp4", "https://xelcode.com/product/", "Product overview →"],
  ["icr", "Doc AI", "Document-AI interfaces for PDF handling, prompt configuration, analysis, and structured results.", ["react", "typescript", "pdf", "document ai"], "2024–2026", "/portfolio/doc_ai.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["workflow", "Workflow", "Approval and operational workflow modules for business-process handling.", ["react", "typescript", "rest api"], "2024–2026", "/portfolio/workflow.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["holiday", "Holiday", "Employee leave administration workflows.", ["react", "typescript"], "2024–2026", "/portfolio/holiday.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["einvoicing", "eInvoicing", "E-invoicing interfaces for integration rules, document and log views, and PDF/XML workflows.", ["react", "typescript", "pdf", "xml"], "2024–2026", "/portfolio/eInvoicing.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["xelapps", "XELapps", "Client and application setup modules for the Xelto platform.", ["react", "typescript", "rest api", "jwt"], "2024–2026", "/portfolio/xelapps.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["cosmic-sugar", "Cosmic Sugar", "Interactive Three.js particle simulation with sculptable push and pull forces.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/cosmic-sugar.mp4", "https://github.com/corashina/cosmic-sugar"],
  ["dont-sleep-with-the-fishes", "Don't Sleep With The Fishes", "Desktop-browser survival game about scavenging a sinking ship and managing a lifeboat while waiting for rescue.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/dont-sleep-with-the-fishes.mp4", "https://github.com/corashina/dont-sleep-with-the-fishes"],
] as const;

const projectMediaAlt: Record<string, string> = {
  "webgl-minecraft": "WebGL Minecraft scene",
  "endless-city": "Infinite procedural WebGL city scene",
  "flappy-pixie": "Flappy Pixie game",
  civio: "Procedural hexagonal map",
  "particle-simulation": "GLSL particle simulation",
  fitmed: "Fitmed interface",
  kiteprint: "Kiteprint interface",
  xelcode: "Xelcode scanner workflow interface",
  icr: "Doc AI document analysis interface",
  workflow: "Workflow approval interface",
  holiday: "Holiday leave administration interface",
  einvoicing: "eInvoicing integration interface",
  xelapps: "XELapps configuration interface",
  "cosmic-sugar": "Cosmic Sugar particle simulation",
  "dont-sleep-with-the-fishes": "Don't Sleep With The Fishes survival game",
};

const projectStartDates: Record<string, { startedAt: string; startedLabel: string }> = {
  "webgl-minecraft": { startedAt: "2018-04", startedLabel: "2018" },
  "endless-city": { startedAt: "2018-09", startedLabel: "2018" },
  "flappy-pixie": { startedAt: "2018-10", startedLabel: "2018" },
  civio: { startedAt: "2018-12", startedLabel: "2018" },
  "particle-simulation": { startedAt: "2019-02", startedLabel: "2019" },
  fitmed: { startedAt: "2018-07", startedLabel: "2018" },
  kiteprint: { startedAt: "2018-09", startedLabel: "2018" },
  xelcode: { startedAt: "2021", startedLabel: "2021" },
  icr: { startedAt: "2025", startedLabel: "2025" },
  workflow: { startedAt: "2024", startedLabel: "2024" },
  holiday: { startedAt: "2024", startedLabel: "2024" },
  einvoicing: { startedAt: "2024", startedLabel: "2024" },
  xelapps: { startedAt: "2026", startedLabel: "2026" },
  "cosmic-sugar": { startedAt: "2026", startedLabel: "2026" },
  "dont-sleep-with-the-fishes": { startedAt: "2026", startedLabel: "2026" },
};

const projectCategories: Record<string, ProjectCategory> = {
  xelapps: "commercial",
  icr: "commercial",
  workflow: "commercial",
  holiday: "commercial",
  einvoicing: "commercial",
  xelcode: "commercial",
  kiteprint: "freelance",
  fitmed: "freelance",
  "particle-simulation": "experiments",
  civio: "experiments",
  "flappy-pixie": "experiments",
  "endless-city": "experiments",
  "webgl-minecraft": "experiments",
  "cosmic-sugar": "experiments",
  "dont-sleep-with-the-fishes": "experiments",
};

export const projects: readonly Project[] = projectData.map(
  ([slug, title, description, tools, date, src, sourceUrl, sourceLabel = "github →"]): Project => ({
    slug,
    title,
    description,
    tools,
    date,
    media: src.endsWith(".mp4")
      ? {
          kind: "video",
          src,
          posterSrc: src.replace(/\.mp4$/i, ".webp"),
          alt: projectMediaAlt[slug],
        }
      : {
          kind: "image",
          src,
          alt: projectMediaAlt[slug],
        },
    sourceUrl,
    sourceLabel,
    category: projectCategories[slug],
    ...projectStartDates[slug],
  }),
).sort((first, second) => second.startedAt.localeCompare(first.startedAt));

export const getProjectBySlug = (slug: string): Project | undefined =>
  projects.find((project) => project.slug === slug);
