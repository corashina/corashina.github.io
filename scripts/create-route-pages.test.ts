// @vitest-environment node
import { mkdir, mkdtemp, writeFile, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import * as pageMeta from "../src/data/pageMeta";
import { person } from "../src/data/person";
import { localizeProject, projects } from "../src/data/projects";
import { messagesFor } from "../src/i18n/messages";
import { createRoutePages } from "./create-route-pages.mjs";

const shell =
  '<html lang="en"><head><title>Portfolio</title><meta name="description" content="Original"><link rel="preload" href="/fonts/questrial-latin-v19.woff2" as="font" type="font/woff2" crossorigin><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div><noscript><p>\n        Tomasz Zielinski, full-stack developer.\n        <a href="mailto:someone@example.com">email</a></p></noscript></body></html>';

async function build() {
  const root = await mkdtemp(join(tmpdir(), "route-pages-"));
  const distDirectory = join(root, "dist");
  const postsDirectory = join(root, "posts");
  await mkdir(distDirectory);
  await mkdir(postsDirectory);
  await writeFile(join(distDirectory, "index.html"), shell);
  await writeFile(join(distDirectory, "404.html"), shell);
  const markdown = '---\ntitle: Quotes " and <tags>\ndescription: Notes & examples\ndate: 2026-09-22\n---\nBody';
  await writeFile(join(postsDirectory, "example.md"), markdown);
  await writeFile(join(postsDirectory, "draft.md"), markdown.replace("\n---\nBody", "\ndraft: true\n---\nBody"));
  const paths = await createRoutePages({
    distDirectory, postsDirectory, projects, localizeProject, messagesFor, pageMeta, person,
  });
  const read = async (path: string) =>
    new JSDOM(await readFile(join(distDirectory, path), "utf8")).window.document;
  return { root, distDirectory, paths, read };
}

const meta = (document: Document, selector: string) =>
  document.querySelector(selector)?.getAttribute("content");

it("writes a page for every app route so direct loads are not served by the 404 fallback", async () => {
  const { root, distDirectory, paths } = await build();
  try {
    const routes = [
      "works",
      ...projects.map((project) => `works/${project.slug}`),
      "contact",
      "blog",
      "blog/example",
    ];
    expect(paths).toEqual(["", ...routes, "pl", ...routes.map((route) => `pl/${route}`)]);
    for (const path of paths) {
      await expect(access(join(distDirectory, path, "index.html"))).resolves.toBeUndefined();
    }
    await expect(access(join(distDirectory, "blog/draft/index.html"))).rejects.toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("gives each route its own title, description, canonical URL and share tags", async () => {
  const { root, read } = await build();
  try {
    const project = await read("works/xelcode/index.html");
    expect(project.title).toBe("Xelcode | Tomasz Zielinski");
    expect(meta(project, 'meta[name="description"]')).toBe(
      "Scanner-driven warehouse and manufacturing workflows integrated with Oracle JD Edwards E1.",
    );
    expect(project.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://www.tomasz-zielinski.com/works/xelcode/",
    );
    expect(meta(project, 'meta[property="og:url"]')).toBe("https://www.tomasz-zielinski.com/works/xelcode/");
    expect(meta(project, 'meta[property="og:image"]')).toBe("https://www.tomasz-zielinski.com/og-card.png");
    expect(meta(project, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(project.querySelector("script")?.getAttribute("src")).toBe("/assets/app.js");
    expect(project.querySelectorAll('meta[name="description"]')).toHaveLength(1);

    const post = await read("blog/example/index.html");
    expect(post.title).toBe('Quotes " and <tags> | Tomasz Zielinski');
    expect(post.querySelector("tags")).toBeNull();
    expect(meta(post, 'meta[name="description"]')).toBe("Notes & examples");
    expect(meta(post, 'meta[property="og:type"]')).toBe("article");
    expect(meta(post, 'meta[property="article:published_time"]')).toBe("2026-09-22");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("adds Person structured data to the home page only and keeps the 404 fallback out of search", async () => {
  const { root, read } = await build();
  try {
    const home = await read("index.html");
    expect(home.title).toBe(pageMeta.homeMeta("en").title);
    expect(home.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://www.tomasz-zielinski.com/",
    );
    const data = JSON.parse(home.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
    expect(data).toMatchObject({ "@type": "Person", name: "Tomasz Zielinski", jobTitle: "Full-stack developer" });

    const works = await read("works/index.html");
    expect(works.querySelector('script[type="application/ld+json"]')).toBeNull();

    const notFound = await read("404.html");
    expect(meta(notFound, 'meta[name="robots"]')).toBe("noindex");
    expect(notFound.querySelector('link[rel="canonical"]')).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("writes a sitemap with every route", async () => {
  const { root, distDirectory, paths } = await build();
  try {
    const sitemap = await readFile(join(distDirectory, "sitemap.xml"), "utf8");
    const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(locations).toEqual(
      paths
        .filter((path) => !path.startsWith("pl/blog/"))
        .map((path) => `https://www.tomasz-zielinski.com/${path ? `${path}/` : ""}`),
    );
    expect(sitemap).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(sitemap).toContain(
      "<loc>https://www.tomasz-zielinski.com/pl/works/</loc>" +
        '<xhtml:link rel="alternate" hreflang="en" href="https://www.tomasz-zielinski.com/works/"/>' +
        '<xhtml:link rel="alternate" hreflang="pl" href="https://www.tomasz-zielinski.com/pl/works/"/>',
    );
    expect(sitemap).toContain(
      "<loc>https://www.tomasz-zielinski.com/blog/example/</loc><lastmod>2026-09-22</lastmod>",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("writes Polish twins with their own language, text and alternates", async () => {
  const { root, read } = await build();
  try {
    const english = await read("works/xelcode/index.html");
    const polish = await read("pl/works/xelcode/index.html");
    const alternates = (document: Document) =>
      Object.fromEntries(
        [...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => [
          link.getAttribute("hreflang"),
          link.getAttribute("href"),
        ]),
      );
    const expected = {
      en: "https://www.tomasz-zielinski.com/works/xelcode/",
      pl: "https://www.tomasz-zielinski.com/pl/works/xelcode/",
      "x-default": "https://www.tomasz-zielinski.com/works/xelcode/",
    };

    expect(english.documentElement.lang).toBe("en");
    expect(polish.documentElement.lang).toBe("pl");
    expect(alternates(english)).toEqual(expected);
    expect(alternates(polish)).toEqual(expected);
    expect(polish.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(expected.pl);
    expect(meta(polish, 'meta[name="description"]')).toBe(
      "Procesy magazynowe i produkcyjne obsługiwane skanerami, zintegrowane z Oracle JD Edwards E1.",
    );
    expect(meta(polish, 'meta[property="og:locale"]')).toBe("pl_PL");
    expect(meta(polish, 'meta[property="og:locale:alternate"]')).toBe("en_US");
    expect(meta(english, 'meta[property="og:locale"]')).toBe("en_US");
    expect(meta(polish, 'meta[property="og:image:alt"]')).toBe(
      "Tomasz Zielinski, programista full-stack: React, TypeScript, .NET",
    );

    const polishHome = await read("pl/index.html");
    expect(polishHome.title).toBe(pageMeta.homeMeta("pl").title);
    expect(polishHome.querySelector("noscript p")?.textContent).toContain("programista full-stack");
    expect(polishHome.querySelector('link[rel="preload"][href="/fonts/questrial-latin-ext-v19.woff2"]')).not.toBeNull();
    expect(english.querySelector('link[href*="latin-ext"]')).toBeNull();
    const data = JSON.parse(polishHome.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
    expect(data).toMatchObject({ "@type": "Person", jobTitle: "Programista full-stack" });

    expect((await read("pl/works/index.html")).title).toBe("Projekty | Tomasz Zielinski");
    expect((await read("pl/contact/index.html")).title).toBe("Kontakt | Tomasz Zielinski");
    expect((await read("pl/blog/index.html")).title).toBe("Artykuły | Tomasz Zielinski");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("points Polish article pages at the English article, which is the only copy", async () => {
  const { root, read } = await build();
  try {
    const polish = await read("pl/blog/example/index.html");
    expect(polish.documentElement.lang).toBe("pl");
    expect(polish.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://www.tomasz-zielinski.com/blog/example/",
    );
    expect(polish.querySelector('link[rel="alternate"][hreflang]')).toBeNull();
    expect(polish.querySelector('meta[property="og:locale:alternate"]')).toBeNull();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
