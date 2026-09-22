declare module "virtual:blog" {
  export const posts: import("./types").PostMeta[];
  export const articleUrls: Record<string, string>;
}
