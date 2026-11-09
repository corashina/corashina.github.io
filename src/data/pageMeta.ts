// Shared by the app (document title and description on navigation) and by the
// build step that writes one HTML file per route (scripts/create-route-pages.mjs).
// Keep runtime imports out of this file: the build script loads it with Node.
import type { Project } from "./projects";

export const siteUrl = "https://www.tomasz-zielinski.com";
export const siteName = "Tomasz Zielinski";
export const shareImage = {
  path: "/og-card.png",
  width: 1200,
  height: 630,
  alt: "Tomasz Zielinski, full-stack developer: React, TypeScript, .NET",
};

export type PageMeta = {
  title: string;
  description: string;
};

export const homeMeta: PageMeta = {
  title: "Tomasz Zielinski · Full-stack developer (React, TypeScript, .NET)",
  description:
    "Full-stack developer with six years at Xelto building React, TypeScript and .NET products: warehouse scanning, approval workflows, Polish e-invoicing (KSeF) and document AI.",
};

const worksMeta: PageMeta = {
  title: `Work | ${siteName}`,
  description:
    "Commercial products, freelance work and side projects by Tomasz Zielinski, full-stack developer.",
};

const contactMeta: PageMeta = {
  title: `Contact | ${siteName}`,
  description: "Contact Tomasz Zielinski, full-stack developer: email, CV, LinkedIn and GitHub.",
};

const notFoundMeta: PageMeta = {
  title: `Page not found | ${siteName}`,
  description: homeMeta.description,
};

export const projectMeta = (project: Project): PageMeta => ({
  title: `${project.title} | ${siteName}`,
  description: project.role ? `${project.description} ${project.role}` : project.description,
});

/** Metadata for every non-blog route; blog routes get theirs from the post. */
export function getPageMeta(pathname: string, projects: readonly Project[]): PageMeta {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return homeMeta;
  if (path === "/works") return worksMeta;
  if (path === "/contact") return contactMeta;
  const projectMatch = /^\/works\/([^/]+)$/.exec(path);
  const project = projectMatch && projects.find((entry) => entry.slug === projectMatch[1]);
  return project ? projectMeta(project) : notFoundMeta;
}
