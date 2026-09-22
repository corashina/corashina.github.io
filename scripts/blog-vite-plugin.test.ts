// @vitest-environment node
import { mkdtemp, writeFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { build, createServer, type ViteDevServer } from "vite";
import { blogPlugin } from "./blog-vite-plugin.mjs";
const roots:string[] = []; const servers:ViteDevServer[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s=>s.close())); await Promise.all(roots.splice(0).map(r=>rm(r,{recursive:true,force:true}))); });
const post=(draft=false) => '---\ntitle: Example\ndescription: Summary\ndate: 2026-09-22\ndraft: '+draft+'\n---\n## Chapter\nBODY_ONLY_MARKER';
async function fixture() {
  const root=await mkdtemp(join(tmpdir(),"blog-vite-")); roots.push(root);
  await mkdir(join(root,"content/posts"),{recursive:true});
  await writeFile(join(root,"content/posts/example.md"),post());
  await writeFile(join(root,"content/posts/draft.md"),post(true));
  await writeFile(join(root,"index.html"),'<script type="module" src="/main.js"></script>');
  await writeFile(join(root,"main.js"),'import {posts,articleUrls} from "virtual:blog"; window.blog={posts,articleUrls};');
  return root;
}
it("emits public bodies separately from catalog JavaScript", async () => {
  const root=await fixture();
  await build({root,configFile:false,logLevel:"silent",plugins:[blogPlugin()],build:{minify:false}});
  const assets=await readdir(join(root,"dist/assets"));
  const js=await readFile(join(root,"dist/assets",assets.find(n=>n.endsWith(".js"))!),"utf8");
  expect(js).toContain("example");
  expect(js).not.toContain("BODY_ONLY_MARKER");
  expect(js).not.toContain('"draft"');
  const jsonFiles=await readdir(join(root,"dist/assets/blog"));
  expect(jsonFiles).toHaveLength(1);
  expect(await readFile(join(root,"dist/assets/blog",jsonFiles[0]),"utf8")).toContain("BODY_ONLY_MARKER");
});
it("refreshes added, edited and deleted posts and stops serving newly drafted content", async () => {
  const root=await fixture();
  const server=await createServer({root,configFile:false,logLevel:"silent",plugins:[blogPlugin()],server:{port:0,host:"127.0.0.1",watch:{usePolling:true,interval:50}}});
  servers.push(server); await server.listen();
  const address=server.httpServer!.address() as {port:number};
  const base="http://127.0.0.1:"+address.port;
  expect((await fetch(base+"/__blog/example.json")).status).toBe(200);
  expect((await fetch(base+"/__blog/draft.json")).status).toBe(404);
  await writeFile(join(root,"content/posts/new.md"),post());
  await expect.poll(async()=>(await fetch(base+"/__blog/new.json")).status).toBe(200);
  await writeFile(join(root,"content/posts/example.md"),post(true));
  await expect.poll(async()=>(await fetch(base+"/__blog/example.json")).status).toBe(404);
  await writeFile(join(root,"content/posts/new.md"),"invalid content");
  await expect.poll(async()=>(await fetch(base+"/__blog/new.json")).status).toBe(500);
  await rm(join(root,"content/posts/new.md"));
  await expect.poll(async()=>(await fetch(base+"/__blog/new.json")).status).toBe(404);
  const catalog=await server.transformRequest("virtual:blog");
  expect(catalog?.code).not.toContain('"new"');
  expect(catalog?.code).not.toContain('"example"');
},15000);
