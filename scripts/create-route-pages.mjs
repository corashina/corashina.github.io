import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { readPublishedPosts } from "./blog-content.mjs";

/**
 * @typedef {"en" | "pl"} Locale
 * @typedef {{ title: string, description: string }} PageMeta
 * @typedef {{
 *   path: string,
 *   locale: Locale,
 *   englishPath: string,
 *   title: string,
 *   description: string,
 *   type?: string,
 *   publishedTime?: string,
 *   lastModified?: string,
 *   person?: boolean,
 *   canonicalPath?: string,
 *   translated: boolean,
 * }} RoutePage
 */

/** @type {readonly Locale[]} */
const locales = ["en", "pl"];

/** @param {string} englishPath @param {Locale} locale */
const localizedPath = (englishPath, locale) =>
  locale === "en" ? englishPath : englishPath ? `pl/${englishPath}` : "pl";

/**
 * Writes one HTML file per route and language so that GitHub Pages answers
 * direct loads with HTTP 200 (instead of the SPA 404 fallback) and link
 * unfurlers (LinkedIn, Slack, Teams) read a route-specific title, description
 * and share image. English lives at the root and Polish under /pl/.
 *
 * Articles are written in English only: their Polish pages exist so readers
 * stay in Polish navigation, but point their canonical URL at the English
 * article and stay out of the sitemap.
 *
 * @param {{
 *   distDirectory: string,
 *   postsDirectory: string,
 *   projects: readonly { slug: string }[],
 *   localizeProject: (project: any, locale: Locale) => any,
 *   messagesFor: (locale: Locale) => { meta: { shareImageAlt: string, noscript: string, jobTitle: string } },
 *   pageMeta: {
 *     siteUrl: string,
 *     siteName: string,
 *     shareImage: { path: string, width: number, height: number, alt: string },
 *     ogLocales: Record<Locale, string>,
 *     getPageMeta: (pathname: string, projects: any) => PageMeta,
 *     articlesMeta: (locale: Locale) => PageMeta,
 *   },
 *   person: Record<string, unknown>,
 * }} options
 */
export async function createRoutePages({
  distDirectory,
  postsDirectory,
  projects,
  localizeProject,
  messagesFor,
  pageMeta,
  person,
}) {
  const shell = await readFile(join(distDirectory, "index.html"), "utf8");
  const posts = await readPublishedPosts(postsDirectory);
  const newestPost = posts.map(({ meta: post }) => post.date).sort().at(-1);

  /** @type {RoutePage[]} */
  const pages = locales.flatMap((locale) => {
    const localizedProjects = projects.map((project) => localizeProject(project, locale));
    const page = (/** @type {string} */ englishPath, /** @type {Partial<RoutePage>} */ extra = {}) => {
      const path = localizedPath(englishPath, locale);
      return {
        path,
        locale,
        englishPath,
        translated: true,
        ...pageMeta.getPageMeta(`/${path}`, localizedProjects),
        ...extra,
      };
    };
    return [
      page("", { type: "profile", person: true }),
      page("works"),
      ...projects.map(({ slug }) => page(`works/${slug}`)),
      page("contact"),
      page("blog", { ...pageMeta.articlesMeta(locale), lastModified: newestPost }),
      ...posts.map(({ meta: post }) =>
        page(`blog/${post.slug}`, {
          title: `${post.title} | ${pageMeta.siteName}`,
          description: post.description,
          type: "article",
          publishedTime: post.date,
          lastModified: post.date,
          translated: false,
          canonicalPath: `blog/${post.slug}`,
        }),
      ),
    ];
  });

  for (const page of pages) {
    const pagePerson = page.person
      ? { ...person, jobTitle: messagesFor(page.locale).meta.jobTitle }
      : undefined;
    const html = renderPage(shell, page, pageMeta, messagesFor(page.locale), pagePerson);
    await mkdir(join(distDirectory, page.path), { recursive: true });
    await writeFile(join(distDirectory, page.path, "index.html"), html);
  }

  // The SPA fallback stays the shell for unknown URLs, but must not be indexed.
  const notFound = new JSDOM(shell);
  const notFoundMeta = pageMeta.getPageMeta("/__not-found__", projects);
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
 * @param {{ siteUrl: string, siteName: string, shareImage: { path: string, width: number, height: number }, ogLocales: Record<Locale, string> }} site
 * @param {{ meta: { shareImageAlt: string, noscript: string } }} messages
 * @param {Record<string, unknown> | undefined} person
 */
function renderPage(shell, page, site, messages, person) {
  const dom = new JSDOM(shell);
  const document = dom.window.document;
  const url = canonicalUrl(site.siteUrl, page.path);
  const image = site.siteUrl + site.shareImage.path;
  const otherLocale = page.locale === "en" ? "pl" : "en";

  document.documentElement.setAttribute("lang", page.locale);
  document.title = page.title;
  setMeta(document, "name", "description", page.description);
  setLink(document, "canonical", canonicalUrl(site.siteUrl, page.canonicalPath ?? page.path));
  if (page.translated) {
    setLink(document, "alternate", canonicalUrl(site.siteUrl, page.englishPath), "en");
    setLink(document, "alternate", canonicalUrl(site.siteUrl, localizedPath(page.englishPath, "pl")), "pl");
    setLink(document, "alternate", canonicalUrl(site.siteUrl, page.englishPath), "x-default");
  }

  setMeta(document, "property", "og:type", page.type ?? "website");
  setMeta(document, "property", "og:site_name", site.siteName);
  setMeta(document, "property", "og:locale", site.ogLocales[page.locale]);
  if (page.translated) setMeta(document, "property", "og:locale:alternate", site.ogLocales[otherLocale]);
  setMeta(document, "property", "og:title", page.title);
  setMeta(document, "property", "og:description", page.description);
  setMeta(document, "property", "og:url", url);
  setMeta(document, "property", "og:image", image);
  setMeta(document, "property", "og:image:width", String(site.shareImage.width));
  setMeta(document, "property", "og:image:height", String(site.shareImage.height));
  setMeta(document, "property", "og:image:alt", messages.meta.shareImageAlt);
  if (page.publishedTime) setMeta(document, "property", "article:published_time", page.publishedTime);
  setMeta(document, "name", "twitter:card", "summary_large_image");
  setMeta(document, "name", "twitter:title", page.title);
  setMeta(document, "name", "twitter:description", page.description);
  setMeta(document, "name", "twitter:image", image);

  if (page.locale === "pl") {
    // Polish letters (ą, ę, ł, ś, ż...) live in the latin-ext subset; fetch it early.
    const latinPreload = document.head.querySelector('link[rel="preload"][href*="questrial-latin-v"]');
    if (latinPreload) {
      const extended = latinPreload.cloneNode();
      extended.setAttribute("href", latinPreload.getAttribute("href").replace("questrial-latin-v", "questrial-latin-ext-v"));
      latinPreload.after(extended);
    }
    const noscriptLine = document.querySelector("noscript p")?.firstChild;
    if (noscriptLine?.nodeType === dom.window.Node.TEXT_NODE) noscriptLine.textContent = `\n        ${messages.meta.noscript}\n        `;
  }

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
 * @param {"canonical" | "alternate"} rel
 * @param {string} href
 * @param {string} [hreflang]
 */
function setLink(document, rel, href, hreflang) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", rel);
    if (hreflang) element.setAttribute("hreflang", hreflang);
    document.head.append(element);
  }
  element.setAttribute("href", href);
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
  const entries = pages
    .filter((page) => page.translated || page.locale === "en")
    .map((page) => {
      const lastModified = page.lastModified ? `<lastmod>${page.lastModified}</lastmod>` : "";
      const alternates = page.translated
        ? locales
            .map((locale) => {
              const href = escapeXml(canonicalUrl(siteUrl, localizedPath(page.englishPath, locale)));
              return `<xhtml:link rel="alternate" hreflang="${locale}" href="${href}"/>`;
            })
            .join("")
        : "";
      return `  <url><loc>${escapeXml(canonicalUrl(siteUrl, page.path))}</loc>${lastModified}${alternates}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const load = (/** @type {string} */ path) =>
    import(pathToFileURL(fileURLToPath(new URL(path, import.meta.url))).href);
  const { projects, localizeProject } = await load("../src/data/projects.ts");
  const pageMeta = await load("../src/data/pageMeta.ts");
  const { messagesFor } = await load("../src/i18n/messages.ts");
  const { person } = await load("../src/data/person.ts");
  await createRoutePages({
    localizeProject,
    messagesFor,
    distDirectory: fileURLToPath(new URL("../dist", import.meta.url)),
    postsDirectory: fileURLToPath(new URL("../content/posts", import.meta.url)),
    projects,
    pageMeta,
    person,
  });
}
