import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { compilePost } from "./blog-content.mjs";

const normalize = text => text.replace(/\r\n?/g, "\n");
const escapeText = text => text.replace(/([\\`*_[\]<>])/g, "\\$1");
const compact = text => text.replace(/\s+/g, " ").trim();
function fence(text, language = "") {
  const delimiter = "`".repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map(run => run.length + 1)));
  return delimiter + language + "\n" + text + (text.endsWith("\n") ? "" : "\n") + delimiter;
}
async function inputs(bundleDirectory) {
  const document = new JSDOM(await readFile(resolve(bundleDirectory, "blog.html"), "utf8")).window.document;
  const links = [...document.querySelectorAll("#sources a[href]")];
  const sources = [];
  for (const link of links) {
    const path = link.getAttribute("href");
    if (!path || path.startsWith("#") || sources.some(source => source.path === path)) continue;
    const target = resolve(bundleDirectory, path);
    const rel = relative(resolve(bundleDirectory), target);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith(".." + "/") || rel.startsWith(".." + "\\") || /-->|[\r\n]/.test(path)) {
      throw new Error("Source outside bundle or invalid path: " + path);
    }
    const bytes = await readFile(target);
    sources.push({path, text: normalize(bytes.toString("utf8")), bytes: bytes.length,
      label: compact(link.textContent), id: "source-" + String(sources.length + 1).padStart(2, "0")});
  }
  return { document, sources };
}

/** Convert this article's semantic HTML, not its page-specific styling. */
export async function convertMibsiArticle(bundleDirectory) {
  const { document, sources } = await inputs(bundleDirectory);
  const sourceIds = new Map(sources.map(source => [source.path, source.id]));
  const inline = node => {
    if (node.nodeType === 3) return escapeText(node.textContent);
    const el = node;
    const children = () => [...el.childNodes].map(inline).join("");
    if (el.tagName === "CODE") {
      const value = el.textContent;
      const ticks = "`".repeat(Math.max(1, ...(value.match(/`+/g) ?? []).map(run => run.length + 1)));
      return ticks + (value.startsWith("`") ? " " : "") + value + (value.endsWith("`") ? " " : "") + ticks;
    }
    if (el.tagName === "BR") return "  \n";
    if (["STRONG", "B"].includes(el.tagName)) return "**" + children() + "**";
    if (["EM", "I"].includes(el.tagName)) return "*" + children() + "*";
    if (el.tagName === "A") {
      const href = el.getAttribute("href") ?? "";
      return "[" + children() + "](" + (sourceIds.has(href) ? "#" + sourceIds.get(href) : href) + ")";
    }
    return children();
  };
  const blocks = node => {
    if (node.nodeType === 3) return node.textContent.trim() ? escapeText(node.textContent.trim()) + "\n\n" : "";
    const el = node;
    if (el.classList.contains("section-no")) return "";
    const childBlocks = () => [...el.childNodes].map(blocks).join("");
    if (/^H[2-6]$/.test(el.tagName)) return "#".repeat(Number(el.tagName.slice(1))) + " " + compact(inline(el)) + "\n\n";
    if (el.tagName === "P") {
      if (el.parentElement?.id === "sources") return "Complete source files are embedded below; each link opens its corresponding appendix entry.\n\n";
      return inline(el).trim() + "\n\n";
    }
    if (el.tagName === "PRE") return fence(normalize(el.textContent), "text") + "\n\n";
    if (el.tagName === "UL" || el.tagName === "OL") {
      return [...el.children].map((li, index) => (el.tagName === "UL" ? "- " : (index + 1) + ". ") + compact([...li.childNodes].map(inline).join(" "))).join("\n") + "\n\n";
    }
    if (el.tagName === "TABLE") {
      const rows = [...el.querySelectorAll("tr")].map(row => [...row.children].map(cell => compact(inline(cell)).replace(/\|/g, "\\|")));
      const caption = el.querySelector("caption");
      return (caption ? "*" + inline(caption) + "*\n\n" : "") +
        rows.map((cells, index) => "| " + cells.join(" | ") + " |\n" + (index === 0 ? "| " + cells.map(() => "---").join(" | ") + " |\n" : "")).join("") + "\n";
    }
    if (el.classList.contains("note")) {
      // Keep the label separated from prose even when the source omits whitespace.
      return "> " + [...el.childNodes].map(inline).join(" ").replace(/\s+/g, " ").trim() + "\n\n";
    }
    if (["code-label", "sequence-title", "sequence-return"].some(name => el.classList.contains(name))) return "*" + inline(el).trim() + "*\n\n";
    if (["SECTION", "ARTICLE", "DIV", "FIGURE"].includes(el.tagName)) return childBlocks();
    if (el.tagName === "FIGCAPTION") return "*" + inline(el).trim() + "*\n\n";
    if (!el.textContent.trim()) return "";
    throw new Error("Unsupported article structure: " + el.tagName + "." + el.className);
  };
  const title = compact(document.title);
  const description = compact(document.querySelector(".dek")?.textContent ?? "");
  const article = document.querySelector("article");
  if (!article || !title || !description) throw new Error("Article title, description or body is missing");
  let architecture = "";
  const figure = document.querySelector(".hero-figure");
  if (figure) {
    const origin = figure.querySelector(".origin");
    const destination = figure.querySelector(".destination");
    const rows = [...figure.querySelectorAll(".path-row")].map(row =>
      [...row.querySelectorAll("span")].map(cell => escapeText(compact(cell.textContent))));
    architecture = "## Two paths, one cluster\n\n" +
      (origin ? [...origin.querySelectorAll("strong,small")].map(el => escapeText(compact(el.textContent))).join(" — ") + "\n\n" : "") +
      "| Path | Input | Processing | Output |\n| --- | --- | --- | --- |\n" +
      rows.map(row => "| " + row.join(" | ") + " |").join("\n") + "\n\n" +
      (destination ? "**Display coordination:** " + escapeText(compact(destination.querySelector("strong")?.textContent ?? "")) + "\n\n" : "") +
      [...figure.querySelectorAll(".plate-head, .plate-foot, figcaption")].map(el => "*" + escapeText(compact([...el.childNodes].map(node => node.textContent).join(" "))) + "*").join("\n\n") + "\n\n";
  }
  const appendix = sources.map(source => {
    const language = ({".java":"java", ".sh":"sh", ".md":"markdown"})[extname(source.path)] ?? "text";
    return "### " + source.id.replace("source-", "Source ") + ": " + escapeText(source.label) + "\n\n" +
      "Original path: `" + source.path + "`\n\n" +
      '<details id="' + source.id + '">\n<summary>Read complete source</summary>\n\n' +
      "<!-- source-file: " + source.path + "; terminal-newline: " + (source.text.endsWith("\n") ? "yes" : "no") + " -->\n\n" +
      fence(source.text, language) + "\n\n</details>\n";
  }).join("\n");
  const result = "---\ntitle: " + JSON.stringify(title) + "\ndescription: " + JSON.stringify(description) +
    '\ndate: "2026-09-22"\ntags: [Reverse engineering, QNX, Automotive]\ndraft: false\n---\n\n' +
    architecture + blocks(article) + "## Source appendix\n\n" + appendix;
  compilePost("reverse-engineering-mibsi.md", result);
  return result;
}

/** Verify copied text independently of the converter's fence writer. */
export async function verifyMibsiSources(markdown, bundleDirectory) {
  const { sources } = await inputs(bundleDirectory);
  const normalized = normalize(markdown);
  const marker = /<!-- source-file: (.+?); terminal-newline: (yes|no) -->\n\n(`{3,})[^\n]*\n/g;
  const found = new Map();
  for (const match of normalized.matchAll(marker)) {
    const start = match.index + match[0].length;
    const closing = normalized.indexOf("\n" + match[3] + "\n", start);
    if (closing < 0) throw new Error("Unclosed source: " + match[1]);
    let text = normalized.slice(start, closing + 1);
    if (match[2] === "no") text = text.slice(0, -1);
    if (found.has(match[1])) throw new Error("Duplicate source " + match[1]);
    found.set(match[1], text);
  }
  if (found.size !== sources.length) throw new Error("Source count mismatch");
  for (const source of sources) {
    if (found.get(source.path) !== source.text) throw new Error("Source content mismatch: " + source.path);
  }
  return { count: sources.length, bytes: sources.reduce((sum, source) => sum + source.bytes, 0) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , bundleDirectory, outputFile] = process.argv;
  if (!bundleDirectory || !outputFile) throw new Error("Usage: import-mibsi-post <bundleDirectory> <outputFile>");
  const markdown = await convertMibsiArticle(bundleDirectory);
  const result = await verifyMibsiSources(markdown, bundleDirectory);
  await mkdir(dirname(outputFile), { recursive:true });
  await writeFile(outputFile, markdown);
  console.log("Verified and embedded " + result.count + " files (" + result.bytes + " source bytes) in " + outputFile);
}
