// Shared by the app (document title and description on navigation) and by the
// build step that writes one HTML file per route (scripts/create-route-pages.mjs).
// The build script loads it with Node, so runtime imports must be local .ts files
// written with their extension and free of browser or package imports.
import { localeFromPath, stripLocale, type Locale } from "../i18n/locales.ts";
import { messagesFor } from "../i18n/messages.ts";
import type { Project } from "./projects";

export const siteUrl = "https://corashina.github.io";
export const siteName = "Tomasz Zielinski";
export const shareImage = {
  path: "/og-card.png",
  width: 1200,
  height: 630,
  alt: messagesFor("en").meta.shareImageAlt,
};

export const ogLocales: Record<Locale, string> = { en: "en_US", pl: "pl_PL" };

export type PageMeta = {
  title: string;
  description: string;
};

/** The site name as written in the given language (Polish spells it Zieliński). */
export const siteNameFor = (locale: Locale): string => messagesFor(locale).meta.name;

const titled = (title: string, locale: Locale): string => `${title} | ${siteNameFor(locale)}`;

export const homeMeta = (locale: Locale): PageMeta => ({
  title: messagesFor(locale).meta.homeTitle,
  description: messagesFor(locale).meta.homeDescription,
});

export const articlesMeta = (locale: Locale): PageMeta => ({
  title: titled(messagesFor(locale).meta.articlesTitle, locale),
  description: messagesFor(locale).meta.articlesDescription,
});

export const projectMeta = (project: Project, locale: Locale = "en"): PageMeta => ({
  title: titled(project.title, locale),
  description: project.description,
});

/**
 * Metadata for every non-blog route in either language; blog routes get theirs
 * from the post. `projects` must already be in the language of `pathname`.
 */
export function getPageMeta(pathname: string, projects: readonly Project[]): PageMeta {
  const locale = localeFromPath(pathname);
  const { meta } = messagesFor(locale);
  const path = stripLocale(pathname).replace(/\/+$/, "") || "/";
  if (path === "/") return homeMeta(locale);
  if (path === "/works") return { title: titled(meta.worksTitle, locale), description: meta.worksDescription };
  if (path === "/contact") return { title: titled(meta.contactTitle, locale), description: meta.contactDescription };
  const projectMatch = /^\/works\/([^/]+)$/.exec(path);
  const project = projectMatch && projects.find((entry) => entry.slug === projectMatch[1]);
  if (project) return projectMeta(project, locale);
  return { title: titled(meta.notFoundTitle, locale), description: meta.homeDescription };
}
