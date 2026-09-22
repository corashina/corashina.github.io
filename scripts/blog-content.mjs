import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import MarkdownIt from "markdown-it";
import { parseDocument } from "yaml";
import sanitizeHtml from "sanitize-html";
import { JSDOM } from "jsdom";

const markdown = new MarkdownIt({ html: true, linkify: false, typographer: false });
const fields = new Set(["title", "description", "date", "tags", "draft"]);

/** @param {string} filePath @param {string} source @returns {import("../src/blog/types").CompiledPost} */
export function compilePost(filePath, source) {
  const fail = (message) => { throw new Error(`${filePath}: ${message}`); };
  const slug = basename(filePath, ".md");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("invalid filename slug");
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) fail("required YAML frontmatter is missing");
  const yaml = parseDocument(match[1], { uniqueKeys: true });
  if (yaml.errors.length) fail("frontmatter: " + yaml.errors.map(e => e.message).join("; "));
  let data;
  try { data = yaml.toJS({ maxAliasCount: 20 }); }
  catch (error) { fail("frontmatter: " + String(error)); }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("frontmatter must be a mapping");
  for (const key of Object.keys(data)) if (!fields.has(key)) fail("unknown field " + key);
  for (const key of ["title", "description"]) {
    if (typeof data[key] !== "string" || !data[key].trim()) fail(key + " must be a nonempty string");
  }
  if (typeof data.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) fail("date must be YYYY-MM-DD");
  const date = new Date(data.date + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.date) fail("date is not a valid calendar date");
  if (data.draft !== undefined && typeof data.draft !== "boolean") fail("draft must be a boolean");
  const tags = data.tags ?? [];
  if (!Array.isArray(tags) || tags.some(tag => typeof tag !== "string" || !tag.trim()) ||
      new Set(tags.map(tag => typeof tag === "string" ? tag.trim() : tag)).size !== tags.length) fail("tags must be unique nonempty strings");

  const safe = sanitizeHtml(markdown.render(normalized.slice(match[0].length)), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "details", "summary", "img"],
    allowedAttributes: {
      "*": ["id"],
      a: ["href", "title"], code: ["class"], details: ["id", "open"],
      img: ["src", "alt", "title"], th: ["scope", "align"], td: ["align"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
  });
  const fragment = JSDOM.fragment(safe);
  const ids = new Set();
  for (const element of fragment.querySelectorAll("[id]")) {
    if (!element.id || /[\s\u0000-\u001f]/.test(element.id)) fail("invalid explicit ID " + element.id);
    if (ids.has(element.id)) fail("duplicate explicit ID " + element.id);
    ids.add(element.id);
  }
  /** @type {import("../src/blog/types").PostHeading[]} */
  const headings = [];
  for (const heading of fragment.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (heading.closest("pre,code")) continue;
    if (heading.tagName === "H1") fail("body headings must start at H2; title supplies the H1");
    const text = heading.textContent.trim();
    if (!heading.id) {
      const stem = text.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
      let id = stem, suffix = 2;
      while (ids.has(id)) id = stem + "-" + suffix++;
      heading.id = id; ids.add(id);
    }
    headings.push({ id: heading.id, text, level: Number(heading.tagName.slice(1)) });
  }
  for (const link of fragment.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!href?.startsWith("#") || href === "#") continue;
    let target;
    try { target = decodeURIComponent(href.slice(1)); }
    catch { fail("malformed fragment " + href); }
    if (!ids.has(target)) fail("missing fragment " + href);
  }
  const container = fragment.ownerDocument.createElement("div");
  container.append(fragment);
  return {
    meta: { slug, title: data.title.trim(), description: data.description.trim(), date: data.date, tags: tags.map(tag => tag.trim()) },
    draft: data.draft ?? false, body: { html: container.innerHTML, headings },
  };
}

/** @param {string} postsDirectory @returns {Promise<import("../src/blog/types").CompiledPost[]>} */
export async function readPublishedPosts(postsDirectory) {
  let entries;
  try { entries = await readdir(postsDirectory, { withFileTypes: true }); }
  catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  const files = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".md"));
  const seen = new Set();
  for (const file of files) {
    const slug = file.name.toLowerCase().slice(0, -3);
    if (seen.has(slug)) throw new Error(`${file.name}: duplicate slug ${slug}`);
    seen.add(slug);
  }
  const posts = await Promise.all(files.map(async file => {
    const path = join(postsDirectory, file.name);
    return compilePost(path, await readFile(path, "utf8"));
  }));
  return posts.filter(post => !post.draft).sort((a, b) =>
    b.meta.date.localeCompare(a.meta.date) || a.meta.slug.localeCompare(b.meta.slug));
}
