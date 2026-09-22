import { posts, articleUrls } from "virtual:blog";
import type { PostBody } from "./types";
export { posts };
export const findPost = (slug: string) => posts.find(post => post.slug === slug);
function isPostBody(value: unknown): value is PostBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return typeof body.html === "string" && Array.isArray(body.headings) &&
    body.headings.every((value: unknown) => {
      if (!value || typeof value !== "object") return false;
      const heading = value as Record<string, unknown>;
      return typeof heading.id === "string" && typeof heading.text === "string" &&
        typeof heading.level === "number" && Number.isInteger(heading.level) &&
        heading.level >= 2 && heading.level <= 6;
    });
}
export async function loadPostBody(slug: string, signal?: AbortSignal): Promise<PostBody> {
  const url = articleUrls[slug];
  if (!url || !findPost(slug)) throw new Error("Article not found");
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Unable to load article");
  const body: unknown = await response.json();
  if (!isPostBody(body)) throw new Error("Invalid article response");
  return body;
}
