// @vitest-environment node
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { convertMibsiArticle, verifyMibsiSources } from "./import-mibsi-post.mjs";
import { compilePost } from "./blog-content.mjs";
const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive:true, force:true }))); });
async function bundle(source: string) {
  const root = await mkdtemp(join(tmpdir(), "mibsi-conversion-")); roots.push(root);
  await writeFile(join(root, "source.txt"), source);
  await writeFile(join(root, "blog.html"), '<html><head><title>Example</title></head><body><p class="dek">Summary</p><article><p>Opening <code>code</code>.</p><section id="first"><h2>Chapter</h2><p>Full narrative.</p></section><section id="sources"><h2>Source trail</h2><ul><li><a href="source.txt">Evidence</a>: context.</li></ul></section></article></body></html>');
  return root;
}
it.each(["one\r\ntwo\r\n", "```md\n# nested\n```\n", "<script>text only</script>", "no trailing newline", "several\n\n\n"])("preserves complete source %j", async source => {
  const root = await bundle(source);
  const markdown = await convertMibsiArticle(root);
  await expect(verifyMibsiSources(markdown, root)).resolves.toMatchObject({count:1, bytes: Buffer.byteLength(source)});
  expect(compilePost("example.md", markdown).body.html).toContain('id="source-01"');
  expect(markdown).toContain("Full narrative.");
});
it("detects edited or missing source text rather than just counting blocks", async () => {
  const root = await bundle("exact evidence");
  const markdown = await convertMibsiArticle(root);
  await expect(verifyMibsiSources(markdown.replace("exact evidence", "false evidence"), root)).rejects.toThrow(/source.txt/);
  await rm(join(root, "source.txt"));
  await expect(convertMibsiArticle(root)).rejects.toThrow(/source.txt/);
});
it("refuses to follow references outside the bundle", async () => {
  const root = await bundle("Evidence");
  const html = await readFile(join(root, "blog.html"), "utf8");
  await writeFile(join(root, "blog.html"), html.replace("source.txt", "../outside.txt"));
  await expect(convertMibsiArticle(root)).rejects.toThrow(/outside/);
});

it("compiles the self-contained first post without its original bundle", async () => {
  const text = await readFile(new URL("../content/posts/reverse-engineering-mibsi.md", import.meta.url), "utf8");
  const {body} = compilePost("reverse-engineering-mibsi.md", text);
  expect((body.html.match(/<details /g) ?? []).length).toBe(18);
  expect(body.html).toContain("LuKa");
  expect(body.headings.filter(h => h.level === 2)).toHaveLength(11);
  expect(body.html).not.toMatch(/href="(?:reverse-engineered|Bootstrap)/);
});

it("separates visual labels from adjacent explanatory text", async () => {
 const root=await bundle("Evidence");
 const file=join(root,"blog.html");
 let html=await readFile(file,"utf8");
 html=html.replace("<article>", '<figure class="hero-figure"><div class="plate-head"><span>Figure</span><span>Context</span></div></figure><article><ol class="event-flow"><li><b>CONNECT</b>Establish the stream.</li></ol>');
 await writeFile(file,html);
 const markdown=await convertMibsiArticle(root);
 expect(markdown).toContain("**CONNECT** Establish the stream.");
 expect(markdown).toContain("Figure Context");
});
