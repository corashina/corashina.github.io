export type PostMeta = { slug: string; title: string; description: string; date: string; tags: string[] };
export type PostHeading = { id: string; text: string; level: number };
export type PostBody = { html: string; headings: PostHeading[] };
export type CompiledPost = { meta: PostMeta; draft: boolean; body: PostBody };
