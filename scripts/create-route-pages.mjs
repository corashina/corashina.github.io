import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { readPublishedPosts } from "./blog-content.mjs";

/**
 * @typedef {{ title: string, description: string }} PageMeta
 * @typedef {{ path: string, title: string, description: string, type?: string, publishedTime?: string, lastModified?: string, person?: boolean }} RoutePage
 */

/**
 * Writes one HTML file per route so that GitHub Pages answers direct loads with
 * HTTP 200 (instead of the SPA 404 fallback) and link unfurlers (LinkedIn,
 * Slack, Teams) read a route-specific title, description and share image.
 *
 * @param {{
 *   distDirectory: string,
 *   postsDirectory: string,
 *   projects: readonly { slug: string }[],
 *   pageMeta: {
 *     siteUrl: string,
 *     siteName: string,
 *     shareImage: { path: string, width: number, height: number, alt: string },
 *     getPageMeta: (pathname: string, projects: any) => PageMeta,
 *   },
 *   person: Record<string, unknown>,
 * }} options
 */
export async function createRoutePages({ distDirectory, postsDirectory, projects, pageMeta, person }) {
  const shell = await readFile(join(distDirectory, "index.html"), "utf8");
  const posts = await readPublishedPosts(postsDirectory);
  const meta = (/** @type {string} */ pathname) => pageMeta.getPageMeta(pathname, projects);
  const newestPost = posts.map(({ meta: post }) => post.date).sort().at(-1);

  /** @type {RoutePage[]} */
  const pages = [
    { path: "", ...meta("/"), type: "profile", person: true },
    { path: "works", ...meta("/works") },
    ...projects.map(({ slug }) => ({ path: `works/${slug}`, ...meta(`/works/${slug}`) })),
    { path: "contact", ...meta("/contact") },
    {
      path: "blog",
      title: `Blog | ${pageMeta.siteName}`,
      description: "Articles and engineering notes by Tomasz Zielinski.",
      lastModified: newestPost,
    },
    ...posts.map(({ meta: post }) => ({
      path: `blog/${post.slug}`,
      title: `${post.title} | ${pageMeta.siteName}`,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      lastModified: post.date,
    })),
  ];

  for (const page of pages) {
    const html = renderPage(shell, page, pageMeta, page.person ? person : undefined);
    await mkdir(join(distDirectory, page.path), { recursive: true });
    await writeFile(join(distDirectory, page.path, "index.html"), html);
  }

  // The SPA fallback stays the shell for unknown URLs, but must not be indexed.
  const notFound = new JSDOM(shell);
  const notFoundMeta = meta("/__not-found__");
  notFound.window.document.title = notFoundMeta.title;
  setMeta(notFound.window.document, "name", "robots", "noindex");
  await writeFile(join(distDirectory, "404.html"), notFound.serialize());
  notFound.window.close();

  await writeFile(join(distDirectory, "sitemap.xml"), renderSitemap(pages, pageMeta.siteUrl));
  return pages.map((page) => page.path);
}

/**
 * @param {string} shell
 * @param {RoutePage} page
 * @param {{ siteUrl: string, siteName: string, shareImage: { path: string, width: number, height: number, alt: string } }} site
 * @param {Record<string, unknown> | undefined} person
 */
function renderPage(shell, page, site, person) {
  const dom = new JSDOM(shell);
  const document = dom.window.document;
  const url = canonicalUrl(site.siteUrl, page.path);
  const image = site.siteUrl + site.shareImage.path;

  document.title = page.title;
  setMeta(document, "name", "description", page.description);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.append(canonical);
  }
  canonical.setAttribute("href", url);

  setMeta(document, "property", "og:type", page.type ?? "website");
  setMeta(document, "property", "og:site_name", site.siteName);
  setMeta(document, "property", "og:title", page.title);
  setMeta(document, "property", "og:description", page.description);
  setMeta(document, "property", "og:url", url);
  setMeta(document, "property", "og:image", image);
  setMeta(document, "property", "og:image:width", String(site.shareImage.width));
  setMeta(document, "property", "og:image:height", String(site.shareImage.height));
  setMeta(document, "property", "og:image:alt", site.shareImage.alt);
  if (page.publishedTime) setMeta(document, "property", "article:published_time", page.publishedTime);
  setMeta(document, "name", "twitter:card", "summary_large_image");
  setMeta(document, "name", "twitter:title", page.title);
  setMeta(document, "name", "twitter:description", page.description);
  setMeta(document, "name", "twitter:image", image);

  if (person) {
    const script = document.createElement("script");
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(person).replace(/</g, "\\u003c");
    document.head.append(script);
  }

  const html = dom.serialize();
  dom.window.close();
  return html;
}

/**
 * @param {Document} document
 * @param {"name" | "property"} attribute
 * @param {string} key
 * @param {string} content
 */
function setMeta(document, attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute("content", content);
}

/** @param {string} siteUrl @param {string} path */
const canonicalUrl = (siteUrl, path) => `${siteUrl}/${path ? `${path}/` : ""}`;

/** @param {string} value */
const escapeXml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** @param {RoutePage[]} pages @param {string} siteUrl */
function renderSitemap(pages, siteUrl) {
  const entries = pages.map((page) => {
    const lastModified = page.lastModified ? `<lastmod>${page.lastModified}</lastmod>` : "";
    return `  <url><loc>${escapeXml(canonicalUrl(siteUrl, page.path))}</loc>${lastModified}</url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const load = (/** @type {string} */ path) =>
    import(pathToFileURL(fileURLToPath(new URL(path, import.meta.url))).href);
  const { projects } = await load("../src/data/projects.ts");
  const pageMeta = await load("../src/data/pageMeta.ts");
  const { person } = await load("../src/data/person.ts");
  await createRoutePages({
    distDirectory: fileURLToPath(new URL("../dist", import.meta.url)),
    postsDirectory: fileURLToPath(new URL("../content/posts", import.meta.url)),
    projects,
    pageMeta,
    person,
  });
}
