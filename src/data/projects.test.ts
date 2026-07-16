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

const recentProjectText = recentProjects
  .map((project) => JSON.stringify(project).toLowerCase())
  .join(" ");

describe("projects", () => {
  it("contains eight unique projects", () => {
    expect(projects).toHaveLength(8);
    expect(new Set(projects.map((project) => project.slug)).size).toBe(8);
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

  it("requires contribution detail for every project", () => {
    expect(projects.every((project) => project.contributions.length >= 1)).toBe(
      true,
    );
    expect(
      recentProjects.every((project) => project.contributions.length >= 3),
    ).toBe(true);
  });

  it("keeps recent work free of URLs", () => {
    expect(recentProjectText).not.toMatch(/https?:\/\/\S+/i);
  });

  it("keeps recent work free of years and date ranges", () => {
    expect(recentProjectText).not.toMatch(
      /\b(?:19|20)\d{2}\s*(?:-|–|—|to)\s*(?:(?:19|20)?\d{2})\b|\b(?:19|20)\d{2}\b/i,
    );
  });

  it("keeps recent work free of commit and repository metrics", () => {
    expect(recentProjectText).not.toMatch(
      /\b(?:\d[\d,.]*\+?\s+)?(?:commits?|repositories|repos?)\b/i,
    );
  });

  it("keeps recent work free of organization attribution", () => {
    expect(recentProjects.every((project) => project.sourceUrl === undefined)).toBe(true);
    expect(recentProjects.every((project) => project.sourceLabel === undefined)).toBe(true);
    expect(recentProjectText).not.toMatch(
      /\b(?:employer|client|company|organi[sz]ation)\s*(?:name\s*)?[:=-]\s*[\w"']/i,
    );
  });

  it("retains the approved public WebGL links, media, and technologies", () => {
    expect(projects.slice(5)).toEqual([
      expect.objectContaining({
        slug: "endless-city",
        title: "Endless City",
        technologies: ["JavaScript", "Three.js", "WebGL", "glTF"],
        media: {
          kind: "video",
          src: "/portfolio/endless-city.mp4",
          alt: "Infinite procedural WebGL city scene",
        },
        sourceUrl: "https://github.com/corashina/Endless-City",
        sourceLabel: "GitHub",
      }),
      expect.objectContaining({
        slug: "particle-simulation",
        title: "Particle Simulation",
        technologies: ["TypeScript", "Three.js", "WebGL", "GLSL"],
        media: {
          kind: "video",
          src: "/portfolio/particle-simulation.mp4",
          alt: "GLSL particle simulation in motion",
        },
        sourceUrl: "https://github.com/corashina/Particle-Simulation",
        sourceLabel: "GitHub",
      }),
      expect.objectContaining({
        slug: "civio",
        title: "Civio",
        technologies: [
          "JavaScript",
          "Three.js",
          "WebGL",
          "Procedural generation",
        ],
        media: {
          kind: "video",
          src: "/portfolio/civio.mp4",
          alt: "Procedural hexagonal map",
        },
        sourceUrl: "https://github.com/corashina/Civio",
        sourceLabel: "GitHub",
      }),
    ]);
  });

  it("looks up by slug", () => {
    expect(getProjectBySlug("document-ai")?.title).toBe("Document AI");
    expect(getProjectBySlug("missing")).toBeUndefined();
  });
});
