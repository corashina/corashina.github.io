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
  /** What Tomasz built, in CV wording where the CV covers the project. */
  role?: string;
  /** Slugs of blog posts that describe the project in depth. */
  writeUps: readonly string[];
};

const projectData = [
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["JavaScript", "Three.js", "WebGL"], "2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/webGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["JavaScript", "Three.js", "WebGL", "glTF"], "2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["JavaScript", "Three.js", "WebGL"], "2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["JavaScript", "Three.js", "WebGL"], "2018", "/portfolio/civio.mp4", "https://github.com/corashina/civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["TypeScript", "Three.js", "WebGL", "GLSL"], "2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype meal-planning system for dietitians", ["JavaScript", "React", "Redux", "Node.js", "Express", "MongoDB"], "2018", "/portfolio/fitmed.webp", "https://github.com/corashina/fitmed"],
  ["xelcode", "Xelcode", "Scanner-driven warehouse and manufacturing workflows integrated with Oracle JD Edwards E1.", ["React", "JavaScript", "TypeScript", "i18next", "Oracle JD Edwards"], "2020–2026", "/portfolio/xelcode.mp4", "https://xelcode.com/product/", "Product overview →"],
  ["icr", "Doc AI", "Document-AI interfaces for PDF handling, prompt configuration, analysis, and structured results.", ["React", "TypeScript", "PDF", "JSON"], "2025–2026", "/portfolio/doc_ai.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["workflow", "Workflow", "Approval and operational workflow modules for business-process handling.", ["React", "TypeScript", "REST API"], "2024–2026", "/portfolio/workflow.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["holiday", "Holiday", "Employee leave administration workflows.", ["React", "TypeScript"], "2024–2026", "/portfolio/holiday.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["einvoicing", "eInvoicing", "E-invoicing interfaces for integration rules, document and log views, and PDF/XML workflows.", ["React", "TypeScript", ".NET", "XSLT/XML", "PDF"], "2024–2026", "/portfolio/eInvoicing.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["xelapps", "XELapps", "Client and application setup modules for the Xelto platform.", ["React", "TypeScript", "React Native/Expo", "Flutter", "REST API", "JWT"], "2024–2026", "/portfolio/xelapps.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["dont-sleep-with-the-fishes", "Don't Sleep With The Fishes", "Desktop-browser survival game about scavenging a sinking ship and managing a lifeboat while waiting for rescue.", ["TypeScript", "Three.js", "WebGL", "GLSL"], "2026", "/portfolio/dont-sleep-with-the-fishes.mp4", "https://github.com/corashina/dont-sleep-with-the-fishes"],
  ["cosmic-sugar", "Cosmic Sugar", "Interactive Three.js particle simulation with sculptable push and pull forces.", ["TypeScript", "Three.js", "WebGL", "GLSL"], "2026", "/portfolio/cosmic-sugar.mp4", "https://github.com/corashina/cosmic-sugar"],
  ["mibsi-cluster-bridge", "MIBSI Cluster Bridge", "Experimental tooling for Android Auto and CarPlay integration with Audi’s Virtual Cockpit, covering navigation bridging, installation packaging, and verification.", ["Java", "Python", "QNX", "Android Auto", "CarPlay"], "2026", "/portfolio/mibsi-cluster-bridge.mp4", "https://github.com/corashina/mibsi-cluster-bridge"],
  ["the-long-slop", "The Long Drive", "Browser recreation of The Long Drive in Rust, Bevy and Rapier, compiled to WebAssembly.", ["Rust", "Bevy", "Rapier", "WebAssembly"], "2026", "/portfolio/the-long-slop.mp4", "https://github.com/corashina/the-long-slop"],
] as const;

const projectMediaAlt: Record<string, string> = {
  "webgl-minecraft": "WebGL Minecraft scene",
  "endless-city": "Infinite procedural WebGL city scene",
  "flappy-pixie": "Flappy Pixie game",
  civio: "Procedural hexagonal map",
  "particle-simulation": "GLSL particle simulation",
  fitmed: "Fitmed interface",
  xelcode: "Xelcode scanner workflow interface",
  icr: "Doc AI document analysis interface",
  workflow: "Workflow approval interface",
  holiday: "Holiday leave administration interface",
  einvoicing: "eInvoicing integration interface",
  xelapps: "XELapps configuration interface",
  "cosmic-sugar": "Cosmic Sugar particle simulation",
  "dont-sleep-with-the-fishes": "Don't Sleep With The Fishes survival game",
  "the-long-slop": "Lada 2101 with its headlights on, parked on a desert road at night",
  "mibsi-cluster-bridge": "Illustrative studio render of a smartphone and digital instrument cluster displaying navigation",
};

const projectStartDates: Record<string, { startedAt: string; startedLabel: string }> = {
  "webgl-minecraft": { startedAt: "2018-04", startedLabel: "2018" },
  "endless-city": { startedAt: "2018-09", startedLabel: "2018" },
  "flappy-pixie": { startedAt: "2018-10", startedLabel: "2018" },
  civio: { startedAt: "2018-12", startedLabel: "2018" },
  "particle-simulation": { startedAt: "2019-02", startedLabel: "2019" },
  fitmed: { startedAt: "2018-09", startedLabel: "2018" },
  xelcode: { startedAt: "2020", startedLabel: "2020" },
  icr: { startedAt: "2025", startedLabel: "2025" },
  workflow: { startedAt: "2024", startedLabel: "2024" },
  holiday: { startedAt: "2024", startedLabel: "2024" },
  einvoicing: { startedAt: "2024", startedLabel: "2024" },
  xelapps: { startedAt: "2026", startedLabel: "2026" },
  "cosmic-sugar": { startedAt: "2026", startedLabel: "2026" },
  "dont-sleep-with-the-fishes": { startedAt: "2026", startedLabel: "2026" },
  "mibsi-cluster-bridge": { startedAt: "2026", startedLabel: "2026" },
  "the-long-slop": { startedAt: "2026-10", startedLabel: "2026" },
};

const projectRoles: Record<string, string> = {
  xelcode:
    "Built React scanner apps for warehouses and production lines, deployed at 12 client companies: barcode reading, per-step validation, label printing, and Oracle JD Edwards integration. Added localisation and multi-step process state to the scanner screens.",
  icr: "Built the interface where users upload PDFs, configure extraction prompts, and review the structured JSON results.",
  workflow: "Built configurable approval and business-process modules that handle documents.",
  holiday:
    "Built leave administration screens in React: leave calculations across calendar years, public holidays, allowance validation, and balances that refresh after approvals.",
  einvoicing:
    "Built screens for Polish e-invoicing (KSeF) integration rules, logs, and PDF/XML invoice views, with XSLT rendering of invoice XML.",
  xelapps:
    "Built the platform's user and application setup and JWT sign-in, plus React Native/Expo and Flutter apps for business-process access.",
  fitmed:
    "Built client intake forms, recipe editing, weekly schedules, and PDF export of the plan, recipes, and shopping list.",
  "mibsi-cluster-bridge":
    "Reverse-engineered Audi's head unit to show Android Auto and CarPlay navigation in the Virtual Cockpit, and packaged an installer with verification checks.",
  "the-long-slop":
    "Recreated the desktop driving-survival game for the browser in Rust, using Bevy and Rapier physics, compiled to WebAssembly.",
};

const projectWriteUps: Record<string, readonly string[]> = {
  xelcode: ["connecting-industrial-scanners-to-a-web-app"],
  icr: ["building-document-ai-pdf-to-json"],
  workflow: ["building-configurable-approval-workflows"],
  holiday: ["calculating-leave-across-calendar-years"],
  einvoicing: ["building-einvoicing-operations-console", "rendering-invoice-xml-with-xslt"],
  xelapps: [
    "building-xelapps-platform-shell",
    "building-modular-expo-business-app",
    "building-flutter-webview-mobile-shell",
  ],
  fitmed: ["from-client-questionnaire-to-weekly-meal-plan"],
  "mibsi-cluster-bridge": ["reverse-engineering-mibsi-cluster-bridge"],
  "the-long-slop": ["recreating-the-long-drive-in-rust-and-webassembly"],
  "dont-sleep-with-the-fishes": ["building-dont-sleep-with-the-fishes"],
  "cosmic-sugar": ["sculpting-particles-with-persistent-forces"],
  "particle-simulation": ["animating-particles-from-birth-time-in-glsl"],
  "webgl-minecraft": ["building-an-editable-voxel-world-in-the-browser"],
};

const projectCategories: Record<string, ProjectCategory> = {
  xelapps: "commercial",
  icr: "commercial",
  workflow: "commercial",
  holiday: "commercial",
  einvoicing: "commercial",
  xelcode: "commercial",
  fitmed: "freelance",
  "mibsi-cluster-bridge": "freelance",
  "particle-simulation": "experiments",
  civio: "experiments",
  "flappy-pixie": "experiments",
  "endless-city": "experiments",
  "webgl-minecraft": "experiments",
  "cosmic-sugar": "experiments",
  "dont-sleep-with-the-fishes": "experiments",
  "the-long-slop": "experiments",
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
    role: projectRoles[slug],
    writeUps: projectWriteUps[slug] ?? [],
    category: projectCategories[slug],
    ...projectStartDates[slug],
  }),
).sort((first, second) => second.startedAt.localeCompare(first.startedAt));

export const getProjectBySlug = (slug: string): Project | undefined =>
  projects.find((project) => project.slug === slug);
