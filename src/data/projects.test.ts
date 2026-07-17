import { describe, expect, it } from "vitest";
import { getProjectBySlug, projects } from "./projects";

const recentProjectSlugs = [
  "warehouse-manufacturing-workflows",
  "business-platforms-approvals",
  "e-invoicing-ksef",
  "document-ai",
  "mobile-applications",
];

const recentProjects = projects.filter((project) =>
  recentProjectSlugs.includes(project.slug),
);

const newProjectSlugs = [
  "shared-ui-components",
  "erp-integration-tooling",
  "webgl-minecraft",
  "points-in-country",
];

const newProjects = projects.filter((project) =>
  newProjectSlugs.includes(project.slug),
);

const privateProjects = projects.filter((project) => !project.sourceUrl);
const privateProjectText = privateProjects
  .map((project) => JSON.stringify(project).toLowerCase())
  .join(" ");

describe("projects", () => {
  it("contains twelve unique projects in the approved order", () => {
    expect(projects).toHaveLength(12);
    expect(new Set(projects.map((project) => project.slug)).size).toBe(12);
    expect(projects.map((project) => project.slug)).toEqual([
      "warehouse-manufacturing-workflows",
      "business-platforms-approvals",
      "shared-ui-components",
      "erp-integration-tooling",
      "e-invoicing-ksef",
      "document-ai",
      "mobile-applications",
      "endless-city",
      "webgl-minecraft",
      "particle-simulation",
      "civio",
      "points-in-country",
    ]);
  });

  it("matches the approved recent project content exactly", () => {
    expect(recentProjects).toEqual([
      {
        slug: "warehouse-manufacturing-workflows",
        title: "Warehouse and Manufacturing Workflows",
        summary:
          "Scanner-led transfers, production, inventory, reservations, and labels.",
        overview:
          "Scanner-led software for warehouse transfers, production steps, inventory checks, reservations, label printing, and ERP-connected processes. The work covers barcode input, operational validation, device-aware interaction, localisation, and workflow state handling.",
        contributions: [
          "Built scanner-led workflows for warehouse transfers and production steps.",
          "Implemented inventory checks, operational validation, reservations, and workflow state handling.",
          "Connected barcode input, label printing, device-aware interaction, localisation, and ERP processes.",
        ],
        technologies: [
          "React",
          "TypeScript",
          "REST APIs",
          "ERP integration",
          "barcode scanners",
        ],
        media: {
          kind: "image",
          src: "/portfolio/warehouse-manufacturing.svg",
          alt: "Warehouse and manufacturing workflow interface",
        },
      },
      {
        slug: "business-platforms-approvals",
        title: "Business Platforms and Approvals",
        summary:
          "Identity, configuration, approvals, scheduling, and vendor processes.",
        overview:
          "Administration and workflow software for users, permissions, authentication, API configuration, approvals, leave management, scheduling, and vendor processes. The work focuses on reusable React and TypeScript architecture, state management, data tables, forms, and shared components.",
        contributions: [
          "Developed administration flows for identity, permissions, authentication, and API configuration.",
          "Built approval, leave-management, scheduling, and vendor workflows.",
          "Created reusable React and TypeScript architecture with state management, data tables, forms, and shared components.",
        ],
        technologies: [
          "React",
          "TypeScript",
          "Redux Toolkit",
          "TanStack Query",
          "Mantine",
        ],
        media: {
          kind: "image",
          src: "/portfolio/business-platforms.svg",
          alt: "Business platform approval workflow interface",
        },
      },
      {
        slug: "e-invoicing-ksef",
        title: "E-invoicing and KSeF",
        summary:
          "Invoice rules, documents, logs, PDF and XML flows, and KSeF integration.",
        overview:
          "Software for invoice integration rules, document handling, logs, PDF and XML flows, and Polish KSeF integration. The work covers frontend workflows and supporting .NET, C#, XSLT, and XML without exposing business data.",
        contributions: [
          "Built frontend workflows for invoice integration rules, document handling, and logs.",
          "Implemented PDF and XML flows supporting KSeF integration.",
          "Developed supporting .NET, C#, XSLT, and XML work while keeping business data private.",
        ],
        technologies: [
          "React",
          "TypeScript",
          ".NET",
          "C#",
          "XML",
          "XSLT",
          "KSeF",
        ],
        media: {
          kind: "image",
          src: "/portfolio/e-invoicing-ksef.svg",
          alt: "E-invoicing and KSeF document workflow interface",
        },
      },
      {
        slug: "document-ai",
        title: "Document AI",
        summary: "PDF intake, prompts, analysis, and JSON or text results.",
        overview:
          "Tools for PDF intake, prompt configuration, document analysis, and structured JSON or text results. The work covers the human review workflow, result presentation, and integration boundaries without presenting private prompts, documents, or customer information.",
        contributions: [
          "Developed PDF intake, prompt configuration, and document analysis workflows.",
          "Built human review and result presentation for structured JSON and text output.",
          "Defined integration boundaries that keep prompts, documents, and customer information private.",
        ],
        technologies: [
          "React",
          "TypeScript",
          "PDF",
          "JSON",
          "AI integration",
        ],
        media: {
          kind: "image",
          src: "/portfolio/document-ai.svg",
          alt: "Document AI review interface",
        },
      },
      {
        slug: "mobile-applications",
        title: "Mobile Applications",
        summary:
          "Authentication, scanning, files, and network-aware mobile workflows.",
        overview:
          "React Native, Expo, and Flutter applications for authenticated business processes, scanning, file handling, and network-aware workflows. The work covers navigation, API integration, secure storage, testing, and device behavior.",
        contributions: [
          "Built authenticated mobile workflows for scanning and file handling.",
          "Integrated navigation, APIs, and secure storage across React Native, Expo, and Flutter applications.",
          "Tested network-aware workflows and device behavior.",
        ],
        technologies: [
          "React Native",
          "Expo",
          "Flutter",
          "TypeScript",
          "REST APIs",
        ],
        media: {
          kind: "image",
          src: "/portfolio/mobile-applications.svg",
          alt: "Mobile application workflow interface",
        },
      },
    ]);
  });

  it("matches the four approved new project records exactly", () => {
    expect(newProjects).toEqual([
      {
        slug: "shared-ui-components",
        title: "Shared UI Components",
        summary: "Reusable React controls, responsive tables, documentation, and package delivery.",
        overview:
          "A reusable React component library for consistent product interfaces. It combines Mantine controls with responsive TanStack tables, Storybook documentation, accessibility checks, Vite library builds, and npm packaging.",
        contributions: [
          "Built reusable form controls and responsive data-table components.",
          "Documented component states and usage in Storybook.",
          "Added unit, browser, and accessibility checks to the package workflow.",
        ],
        technologies: [
          "React",
          "TypeScript",
          "Mantine",
          "TanStack Table",
          "Storybook",
          "Vite",
          "Vitest",
          "Playwright",
        ],
        media: {
          kind: "image",
          src: "/portfolio/shared-ui-components.svg",
          alt: "Reusable interface components and responsive data table",
        },
      },
      {
        slug: "erp-integration-tooling",
        title: "ERP Integration Tooling",
        summary: "Typed n8n nodes for credentials, REST orchestration, and ERP workflows.",
        overview:
          "Integration tooling that connects automation workflows to Oracle JD Edwards through typed custom n8n nodes. It covers credential configuration, REST request orchestration, node metadata, package builds, and npm delivery.",
        contributions: [
          "Built typed n8n nodes for Oracle JD Edwards orchestration endpoints.",
          "Implemented credential handling and configurable REST request flows.",
          "Prepared build, lint, and package tooling for repeatable delivery.",
        ],
        technologies: [
          "TypeScript",
          "Node.js",
          "n8n",
          "REST APIs",
          "Oracle JD Edwards",
          "npm",
        ],
        media: {
          kind: "image",
          src: "/portfolio/erp-integration-tooling.svg",
          alt: "Automation nodes connected to an ERP service",
        },
      },
      {
        slug: "webgl-minecraft",
        title: "WebGL Minecraft",
        summary: "A voxel world with movement, collisions, and generated terrain.",
        overview:
          "A public Three.js voxel-world experiment with pointer-lock controls, collision detection, block selection, and simple infinite terrain generation.",
        contributions: [
          "Built first-person movement and pointer-lock controls.",
          "Added terrain collisions and selectable block types.",
          "Generated simple terrain as the player moves through the world.",
        ],
        technologies: ["JavaScript", "Three.js", "WebGL", "procedural generation"],
        media: {
          kind: "image",
          src: "/portfolio/webgl-minecraft.png",
          alt: "Voxel terrain in the WebGL Minecraft experiment",
        },
        sourceUrl: "https://github.com/corashina/WebGL-Minecraft",
        sourceLabel: "GitHub",
      },
      {
        slug: "points-in-country",
        title: "points-in-country",
        summary: "Coordinate grids generated inside 206 country boundaries.",
        overview:
          "A public npm package that generates arrays of coordinates inside country boundaries. It includes boundary data for 206 countries and a configurable interval for controlling grid density.",
        contributions: [
          "Built coordinate-grid generation within country boundaries.",
          "Packaged boundary data for 206 countries.",
          "Published a configurable interval for controlling point density.",
        ],
        technologies: ["JavaScript", "Node.js", "geospatial data", "npm"],
        media: {
          kind: "image",
          src: "/portfolio/points-in-country.svg",
          alt: "Coordinate grid clipped to a country boundary",
        },
        sourceUrl: "https://github.com/corashina/points-in-country",
        sourceLabel: "GitHub",
      },
    ]);
  });

  it("requires contribution detail for every project", () => {
    expect(projects.every((project) => project.contributions.length >= 1)).toBe(
      true,
    );
    expect(
      privateProjects.every((project) => project.contributions.length >= 3),
    ).toBe(true);
  });

  it("keeps recent work free of URLs", () => {
    expect(privateProjectText).not.toMatch(/https?:\/\/\S+/i);
  });

  it("keeps recent work free of years and date ranges", () => {
    expect(privateProjectText).not.toMatch(
      /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)?\d{2})\b|\b(?:19|20)\d{2}\b/i,
    );
  });

  it("keeps recent work free of commit and repository metrics", () => {
    expect(privateProjectText).not.toMatch(
      /\b(?:\d[\d,.]*\+?\s+)?(?:commits?|repositories|repos?)\b/i,
    );
  });

  it("keeps recent work free of organization attribution", () => {
    expect(privateProjects.every((project) => project.sourceUrl === undefined)).toBe(true);
    expect(privateProjects.every((project) => project.sourceLabel === undefined)).toBe(true);
    expect(privateProjectText).not.toMatch(
      /\b(?:employer|client|company|organi[sz]ation)\s*(?:name\s*)?[:=-]\s*[\w"']/i,
    );
  });

  it("retains the five approved public project links and media", () => {
    expect(projects.filter((project) => project.sourceUrl)).toEqual([
      expect.objectContaining({
        slug: "endless-city",
        sourceUrl: "https://github.com/corashina/Endless-City",
        media: expect.objectContaining({ src: "/portfolio/endless-city.mp4" }),
      }),
      expect.objectContaining({
        slug: "webgl-minecraft",
        sourceUrl: "https://github.com/corashina/WebGL-Minecraft",
        media: expect.objectContaining({ src: "/portfolio/webgl-minecraft.png" }),
      }),
      expect.objectContaining({
        slug: "particle-simulation",
        sourceUrl: "https://github.com/corashina/Particle-Simulation",
        media: expect.objectContaining({ src: "/portfolio/particle-simulation.mp4" }),
      }),
      expect.objectContaining({
        slug: "civio",
        sourceUrl: "https://github.com/corashina/Civio",
        media: expect.objectContaining({ src: "/portfolio/civio.mp4" }),
      }),
      expect.objectContaining({
        slug: "points-in-country",
        sourceUrl: "https://github.com/corashina/points-in-country",
        media: expect.objectContaining({ src: "/portfolio/points-in-country.svg" }),
      }),
    ]);
  });

  it("looks up by slug", () => {
    expect(getProjectBySlug("document-ai")?.title).toBe("Document AI");
    expect(getProjectBySlug("missing")).toBeUndefined();
  });
});
