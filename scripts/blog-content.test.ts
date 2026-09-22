// @vitest-environment node
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { compilePost, readPublishedPosts } from "./blog-content.mjs";
const post = (body: string, fields = "") =>
  `---\ntitle: Test\ndescription: Summary\ndate: 2026-09-22\n${fields}---\n${body}`;
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, {recursive:true, force:true}))); });
it("assigns unique headings, excluding fenced source headings", () => {
  const result = compilePost("example.md", post("## Start\n\n## Start\n\n```text\n## Hidden\n```"));
  expect(result.body.headings.map(h => h.id)).toEqual(["start", "start-2"]);
  expect(result.meta.slug).toBe("example");
});
it.each([
  ["date", post("Text").replace("2026-09-22", "2026-02-30")],
  ["draft", post("Text", 'draft: "false"\n')],
  ["tags", post("Text", "tags: [one, one]\n")],
  ["unknown", post("Text", "unknown: value\n")],
  ["title", post("Text", "title: Duplicate\n")],
])("rejects invalid %s with the source filename", (field, source) => {
  expect(() => compilePost("bad.md", source)).toThrow(new RegExp("bad.md.*" + field, "s"));
});
it("retains safe disclosures and image descriptions but removes executable HTML", () => {
  const { body } = compilePost("safe.md", post('<details id="source"><summary>Code</summary>\n\n```sh\necho hi\n```\n\n</details>\n\n<script>alert(1)</script>\n<a href="javascript:alert(1)" onclick="oops()">Bad</a>\n\n![Description](https://example.com/image.png)'));
  expect(body.html).toContain('<details id="source">');
  expect(body.html).toContain("echo hi");
  expect(body.html).toContain('alt="Description"');
  expect(body.html).not.toMatch(/<script|javascript:|onclick/);
});
it.each(["[Missing](#absent)", "[Bad](#%ZZ)", '<span id="x"></span><span id="x"></span>'])("rejects broken or ambiguous fragment targets", body => {
  expect(() => compilePost("links.md", post(body))).toThrow(/links.md/);
});
it("reserves explicit IDs and supports unicode headings", () => {
  const result = compilePost("ids.md", post('<span id="start"></span>\n\n## Start\n\n## Żółć\n\n[Read](#%C5%BC%C3%B3%C5%82%C4%87)'));
  expect(result.body.headings.map(h => h.id)).toEqual(["start-2", "żółć"]);
});
it("discovers, sorts and excludes drafts while validating them", async () => {
  const root = await mkdtemp(join(tmpdir(), "blog-content-")); roots.push(root);
  expect(await readPublishedPosts(root)).toEqual([]);
  await writeFile(join(root, "z.md"), post("Z"));
  await writeFile(join(root, "a.md"), post("A"));
  await writeFile(join(root, "draft.md"), post("Secret", "draft: true\n").replace("2026-09-22", "2026-09-23"));
  expect((await readPublishedPosts(root)).map(p => p.meta.slug)).toEqual(["a", "z"]);
  await writeFile(join(root, "draft.md"), post("Secret", "draft: true\ntags: wrong\n"));
  await expect(readPublishedPosts(root)).rejects.toThrow(/draft.md.*tags/);
});
it.each(["Upper.md", "bad_name.md"])("rejects invalid filename %s", name => {
  expect(() => compilePost(name, post("Body"))).toThrow(/slug/);
});
