import type { Locale } from "../i18n/locales";

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
  ["webgl-minecraft", "WebGL-Minecraft", "Primitive minecraft clone made with three.js", ["javascript", "three.js", "webgl"], "2018", "/portfolio/webgl-minecraft.mp4", "https://github.com/corashina/webGL-Minecraft"],
  ["endless-city", "Endless-City", "Infinite WebGL scene heavily inspired by littleworkshop.fr", ["javascript", "three.js", "webgl", "gltf"], "2018", "/portfolio/endless-city.mp4", "https://github.com/corashina/endless-City"],
  ["flappy-pixie", "Flappy-Pixie", "Flappy Bird clone made in one week for an interview challenge", ["javascript", "three.js", "webgl"], "2018", "/portfolio/flappy-pixie.mp4", "https://github.com/corashina/flappy-Pixie"],
  ["civio", "Civio", "Hexagonal map generation using simplex noise", ["javascript", "three.js", "webgl"], "2018", "/portfolio/civio.mp4", "https://github.com/corashina/civio"],
  ["particle-simulation", "Particle Simulation", "Particle generator made with GLSL", ["typescript", "three.js", "webgl", "glsl"], "2019", "/portfolio/particle-simulation.mp4", "https://github.com/corashina/particle-Simulation"],
  ["fitmed", "Fitmed", "Prototype system for dieteticians", ["javascript", "react", "redux", "node", "express", "mongodb"], "2018", "/portfolio/fitmed.webp", "https://github.com/corashina/fitmed"],
  ["xelcode", "Xelcode", "Scanner-driven warehouse and manufacturing workflows integrated with Oracle JD Edwards E1.", ["react", "typescript", "javascript", "i18next", "oracle jd edwards"], "2021–2026", "/portfolio/xelcode.mp4", "https://xelcode.com/product/", "Product overview →"],
  ["icr", "Doc AI", "Document-AI interfaces for PDF handling, prompt configuration, analysis, and structured results.", ["react", "typescript", "pdf", "document ai"], "2024–2026", "/portfolio/doc_ai.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["workflow", "Workflow", "Approval and operational workflow modules for business-process handling.", ["react", "typescript", "rest api"], "2024–2026", "/portfolio/workflow.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["holiday", "Holiday", "Employee leave administration workflows.", ["react", "typescript"], "2024–2026", "/portfolio/holiday.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["einvoicing", "eInvoicing", "E-invoicing interfaces for integration rules, document and log views, and PDF/XML workflows.", ["react", "typescript", "pdf", "xml"], "2024–2026", "/portfolio/eInvoicing.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["xelapps", "XELapps", "Client and application setup modules for the Xelto platform.", ["react", "typescript", "rest api", "jwt"], "2024–2026", "/portfolio/xelapps.mp4", "https://xelto.ai/en/live-demo", "Product overview →"],
  ["dont-sleep-with-the-fishes", "Don't Sleep With The Fishes", "Desktop-browser survival game about scavenging a sinking ship and managing a lifeboat while waiting for rescue.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/dont-sleep-with-the-fishes.mp4", "https://github.com/corashina/dont-sleep-with-the-fishes"],
  ["cosmic-sugar", "Cosmic Sugar", "Interactive Three.js particle simulation with sculptable push and pull forces.", ["typescript", "three.js", "webgl", "glsl"], "2026", "/portfolio/cosmic-sugar.mp4", "https://github.com/corashina/cosmic-sugar"],
  ["mibsi-cluster-bridge", "MIBSI Cluster Bridge", "Experimental tooling for Android Auto and CarPlay integration with Audi’s Virtual Cockpit, covering navigation bridging, installation packaging, and verification.", ["java", "python", "qnx", "android auto", "carplay"], "2026", "/portfolio/mibsi-cluster-bridge.mp4", "https://github.com/corashina/mibsi-cluster-bridge"],
  ["the-long-slop", "The Long Drive", "Browser recreation of The Long Drive in Rust, Bevy and Rapier, compiled to WebAssembly.", ["rust", "bevy", "rapier", "webassembly"], "2026", "/portfolio/the-long-slop.mp4", "https://github.com/corashina/the-long-drive"],
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
  xelcode: { startedAt: "2021", startedLabel: "2021" },
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
    category: projectCategories[slug],
    ...projectStartDates[slug],
  }),
).sort((first, second) => second.startedAt.localeCompare(first.startedAt));

type ProjectSlug = (typeof projectData)[number][0];

/** Polish text for each project; titles, tools and links stay the same. */
const polishProjectText: Record<ProjectSlug, { description: string; alt: string }> = {
  "webgl-minecraft": {
    description: "Prosty klon Minecrafta zrobiony w three.js",
    alt: "Scena z klonu Minecrafta w WebGL",
  },
  "endless-city": {
    description: "Nieskończona scena WebGL mocno inspirowana littleworkshop.fr",
    alt: "Nieskończona proceduralna scena miasta w WebGL",
  },
  "flappy-pixie": {
    description: "Klon Flappy Bird zrobiony w tydzień jako zadanie rekrutacyjne",
    alt: "Gra Flappy Pixie",
  },
  civio: {
    description: "Generowanie heksagonalnej mapy z użyciem szumu simplex",
    alt: "Proceduralna mapa heksagonalna",
  },
  "particle-simulation": {
    description: "Generator cząsteczek napisany w GLSL",
    alt: "Symulacja cząsteczek w GLSL",
  },
  fitmed: {
    description: "Prototyp systemu dla dietetyków",
    alt: "Interfejs Fitmed",
  },
  xelcode: {
    description: "Procesy magazynowe i produkcyjne obsługiwane skanerami, zintegrowane z Oracle JD Edwards E1.",
    alt: "Interfejs Xelcode do pracy ze skanerem",
  },
  icr: {
    description: "Interfejsy Document AI do obsługi plików PDF, konfiguracji promptów, analizy i ustrukturyzowanych wyników.",
    alt: "Interfejs Doc AI do analizy dokumentów",
  },
  workflow: {
    description: "Moduły akceptacji i obiegu zadań do obsługi procesów biznesowych.",
    alt: "Interfejs akceptacji w Workflow",
  },
  holiday: {
    description: "Procesy administrowania urlopami pracowników.",
    alt: "Interfejs Holiday do zarządzania urlopami",
  },
  einvoicing: {
    description: "Interfejsy e-fakturowania: reguły integracji, podgląd dokumentów i logów oraz obsługa PDF/XML.",
    alt: "Interfejs integracji eInvoicing",
  },
  xelapps: {
    description: "Moduły konfiguracji klientów i aplikacji na platformie Xelto.",
    alt: "Interfejs konfiguracji XELapps",
  },
  "dont-sleep-with-the-fishes": {
    description: "Gra survivalowa w przeglądarce na komputer: przeszukujesz tonący statek i zarządzasz szalupą, czekając na ratunek.",
    alt: "Gra survivalowa Don't Sleep With The Fishes",
  },
  "cosmic-sugar": {
    description: "Interaktywna symulacja cząsteczek w Three.js z siłami przyciągania i odpychania, którymi można rzeźbić.",
    alt: "Symulacja cząsteczek Cosmic Sugar",
  },
  "mibsi-cluster-bridge": {
    description: "Eksperymentalne narzędzia do integracji Android Auto i CarPlay z Audi Virtual Cockpit: przekazywanie nawigacji, pakiet instalacyjny i weryfikacja.",
    alt: "Poglądowy render studyjny smartfona i cyfrowych zegarów z nawigacją",
  },
  "the-long-slop": {
    description: "Przeglądarkowa wersja The Long Drive w Rust, Bevy i Rapier, skompilowana do WebAssembly.",
    alt: "Łada 2101 z zapalonymi światłami, zaparkowana nocą na pustynnej drodze",
  },
};

const polishSourceLabels: Record<string, string> = {
  "Product overview →": "Opis produktu →",
};

/** Returns the project with its text in the given language. */
export const localizeProject = (project: Project, locale: Locale): Project => {
  if (locale === "en") return project;
  const text = polishProjectText[project.slug as ProjectSlug];
  if (!text) return project;
  return {
    ...project,
    description: text.description,
    media: { ...project.media, alt: text.alt },
    sourceLabel: polishSourceLabels[project.sourceLabel] ?? project.sourceLabel,
  };
};

export const getProjectBySlug = (slug: string): Project | undefined =>
  projects.find((project) => project.slug === slug);
