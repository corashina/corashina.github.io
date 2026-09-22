import { createHash } from "node:crypto";
import { resolve, relative, isAbsolute } from "node:path";
import { readPublishedPosts } from "./blog-content.mjs";

/** @param {{postsDirectory?:string}} [options] @returns {import("vite").Plugin} */
export function blogPlugin(options = {}) {
  const id = "virtual:blog", resolvedId = "\0" + id;
  let directory, config;
  let posts = [], urls = {};
  let error = null;
  let refresh = Promise.resolve();
  const reload = () => {
    refresh = refresh.then(async () => {
      try { posts = await readPublishedPosts(directory); error = null; }
      catch (caught) { posts = []; urls = {}; error = caught; }
    });
    return refresh;
  };
  const assertReady = () => { if (error) throw error; };
  return {
    name: "portfolio-blog",
    configResolved(value) {
      config = value;
      directory = resolve(value.root, options.postsDirectory ?? "content/posts");
    },
    async buildStart() {
      await reload(); assertReady();
      urls = {};
      for (const post of posts) {
        if (config.command === "build") {
          const source = JSON.stringify(post.body);
          const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
          const fileName = "assets/blog/" + post.meta.slug + "-" + hash + ".json";
          this.emitFile({ type:"asset", fileName, source });
          urls[post.meta.slug] = config.base + fileName;
        } else urls[post.meta.slug] = config.base + "__blog/" + post.meta.slug + ".json";
      }
    },
    resolveId(source) { if (source === id) return resolvedId; },
    async load(source) {
      if (source !== resolvedId) return;
      await refresh; assertReady();
      const currentUrls = config.command === "serve" ?
        Object.fromEntries(posts.map(post => [post.meta.slug, config.base + "__blog/" + post.meta.slug + ".json"])) : urls;
      return "export const posts=" + JSON.stringify(posts.map(post => post.meta)) +
        "; export const articleUrls=" + JSON.stringify(currentUrls) + ";";
    },
    configureServer(server) {
      const prefix = config.base + "__blog/";
      server.middlewares.use(async (request, response, next) => {
        const pathname = (request.url ?? "").split("?")[0];
        if (!pathname.startsWith(prefix)) return next();
        await refresh;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        if (error) { response.statusCode = 500; response.end(JSON.stringify({error:String(error)})); return; }
        const slug = pathname.slice(prefix.length).replace(/\.json$/, "");
        const post = pathname.endsWith(".json") && posts.find(post => post.meta.slug === slug);
        if (!post) { response.statusCode = 404; response.end('{"error":"Article not found"}'); return; }
        response.end(JSON.stringify(post.body));
      });
      server.watcher.add(directory);
      const changed = async path => {
        const rel = relative(directory, path);
        if (isAbsolute(rel) || rel.startsWith("..") || !path.toLowerCase().endsWith(".md")) return;
        await reload();
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(resolvedId);
          if (module) environment.moduleGraph.invalidateModule(module);
        }
        server.ws.send({type:"full-reload",path:"*"});
      };
      server.watcher.on("add", changed).on("change", changed).on("unlink", changed);
      server.httpServer?.once("close", () => {
        server.watcher.off("add",changed).off("change",changed).off("unlink",changed);
      });
    },
  };
}
