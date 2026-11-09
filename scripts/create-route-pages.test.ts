// @vitest-environment node
import { mkdir, mkdtemp, writeFile, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import * as pageMeta from "../src/data/pageMeta";
import { person } from "../src/data/profile";
import { projects } from "../src/data/projects";
import { createRoutePages } from "./create-route-pages.mjs";

const shell =
  '<html><head><title>Portfolio</title><meta name="description" content="Original"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';

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
  const paths = await createRoutePages({ distDirectory, postsDirectory, projects, pageMeta, person });
  const read = async (path: string) =>
    new JSDOM(await readFile(join(distDirectory, path), "utf8")).window.document;
  return { root, distDirectory, paths, read };
}

const meta = (document: Document, selector: string) =>
  document.querySelector(selector)?.getAttribute("content");

it("writes a page for every app route so direct loads are not served by the 404 fallback", async () => {
  const { root, distDirectory, paths } = await build();
  try {
    expect(paths).toEqual([
      "",
      "works",
      ...projects.map((project) => `works/${project.slug}`),
      "contact",
      "blog",
      "blog/example",
    ]);
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
    expect(meta(project, 'meta[name="description"]')).toMatch(/deployed at 12 client companies/);
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
    expect(home.title).toBe(pageMeta.homeMeta.title);
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
      paths.map((path) => `https://www.tomasz-zielinski.com/${path ? `${path}/` : ""}`),
    );
    expect(sitemap).toContain(
      "<loc>https://www.tomasz-zielinski.com/blog/example/</loc><lastmod>2026-09-22</lastmod>",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
