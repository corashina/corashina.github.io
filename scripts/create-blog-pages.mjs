import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { readPublishedPosts } from "./blog-content.mjs";

/** @param {{distDirectory:string,postsDirectory:string}} options */
export async function createBlogPages({ distDirectory, postsDirectory }) {
  const shell = await readFile(join(distDirectory, "index.html"), "utf8");
  const posts = await readPublishedPosts(postsDirectory);
  const pages = [
    { path:"blog", title:"Blog | Tomasz Zielinski", description:"Articles and engineering notes by Tomasz Zielinski." },
    ...posts.map(({meta}) => ({ path:"blog/" + meta.slug, title:meta.title + " | Tomasz Zielinski", description:meta.description })),
  ];
  for (const page of pages) {
    const dom = new JSDOM(shell);
    const document = dom.window.document;
    document.title = page.title;
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement("meta"); description.setAttribute("name", "description"); document.head.append(description); }
    description.setAttribute("content", page.description);
    await mkdir(join(distDirectory, page.path), { recursive:true });
    await writeFile(join(distDirectory, page.path, "index.html"), dom.serialize());
    dom.window.close();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await createBlogPages({
    distDirectory:fileURLToPath(new URL("../dist", import.meta.url)),
    postsDirectory:fileURLToPath(new URL("../content/posts", import.meta.url)),
  });
}
