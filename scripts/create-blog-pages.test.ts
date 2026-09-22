// @vitest-environment node
import { mkdir, mkdtemp, writeFile, readFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { createBlogPages } from "./create-blog-pages.mjs";
it("writes directly served routes with escaped metadata, intact assets, and no draft route",async()=>{
  const root=await mkdtemp(join(tmpdir(),"blog-shells-"));
  try {
    const distDirectory=join(root,"dist"),postsDirectory=join(root,"posts");
    await mkdir(distDirectory);await mkdir(postsDirectory);
    const shell='<html><head><title>Portfolio</title><meta name="description" content="Original"><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>';
    await writeFile(join(distDirectory,"index.html"),shell);
    const markdown='---\ntitle: Quotes " and <tags>\ndescription: Notes & examples\ndate: 2026-09-22\n---\nBody';
    await writeFile(join(postsDirectory,"example.md"),markdown);
    await writeFile(join(postsDirectory,"draft.md"),markdown.replace("\n---\nBody","\ndraft: true\n---\nBody"));
    await createBlogPages({distDirectory,postsDirectory});
    const html=await readFile(join(distDirectory,"blog/example/index.html"),"utf8");
    const document=new JSDOM(html).window.document;
    expect(document.title).toBe('Quotes " and <tags> | Tomasz Zielinski');
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Notes & examples");
    expect(document.querySelector("script")?.getAttribute("src")).toBe("/assets/app.js");
    expect(document.querySelector("tags")).toBeNull();
    expect(await readFile(join(distDirectory,"index.html"),"utf8")).toBe(shell);
    expect(await readFile(join(distDirectory,"blog/index.html"),"utf8")).toContain("Blog | Tomasz Zielinski");
    await expect(access(join(distDirectory,"blog/draft/index.html"))).rejects.toThrow();
  } finally { await rm(root,{recursive:true,force:true}); }
});
