# Publishing a blog post

Every article is one Markdown file in `content/posts/`. Its title, date, summary,
tags, and body all live in that file. Adding a post never requires editing routes,
navigation, or an article registry.

## Start a post

Copy `docs/blog-post-template.md` to `content/posts/your-article-name.md`.
Use lowercase letters, digits, and single hyphens in the filename. The filename
becomes the permanent URL: `/blog/your-article-name/`.

Edit the metadata at the top:

```yaml
---
title: "A useful discovery"
description: "A short explanation of what readers will learn."
date: "2026-09-22"
tags: [Engineering, Notes]
draft: true
---
```

- Set `date` to your publication date in YYYY-MM-DD format.
- Title and description are required; quote text containing colons.
- Tags are optional and must be unique. Draft defaults to false if omitted.
- Keep the filename stable after publication so shared URLs continue working.

## Write the article

Start with an introduction and use `##` for sections and `###` for subsections.
The title is rendered automatically; do not add another `#` heading.
Sections automatically appear in the article contents. Heading anchors use
lowercase words joined by hyphens; repeated headings receive `-2`, `-3`, etc.

Supported Markdown includes lists, emphasis, tables, blockquotes, links,
remote images with descriptive alt text, and fenced code blocks. No React or MDX
is needed. Keep source material and diagrams as text or tables inside the same file
when you want an entirely self-contained article.

## Include complete source files

Paste source text into a fenced block. Use a language label such as `java`,
`sh`, `markdown`, or `text`. If the source contains backticks, use an outer fence
longer than any backtick sequence in that source.

For a long source, wrap the block in a disclosure. Keep blank lines before and
after the fenced block so Markdown is parsed correctly:

````markdown
[Read the source](#source-example)

<details id="source-example">
<summary>Read complete source</summary>

```text
The complete source text.
```

</details>
````

Use unique explicit IDs without spaces. Source links open the matching disclosure.
Relative links to local files are not copied automatically: paste the needed
content into the post and link to its heading or disclosure instead.
JavaScript, styles, embedded applications, and unsafe links are removed from rendered HTML.

## Preview and publish

1. Run `npm ci` after checking out the repository.
2. Set `draft: false` locally to preview the post. Drafts are excluded from both
   the local site and production, although their metadata and Markdown are validated.
3. Run `npm run dev` and open `/blog`. Adding, editing, or deleting a post refreshes
   the running site automatically.
4. Check the post on mobile and desktop, including code, tables, and source links.
5. Run `npm run verify`. Invalid metadata, duplicate IDs, and broken fragment links
   fail with the source filename and reason.
6. Commit your single Markdown file. Restore `draft: true` first if it must remain
   unpublished.
7. Publish through the repository's existing review/merge process. Pushing to
   `master` triggers the existing GitHub Pages deployment workflow.

For a production preview, run `npm run build`, then `npx vite preview`.
The build creates direct entry pages for published blog URLs. Markdown parsing
happens during development/build; the browser downloads a post body only when opened.

## First post provenance

`reverse-engineering-mibsi.md` contains the MIBSI narrative plus all 18 originally
linked source files, copied in full with LF-normalized newlines. No original
source bundle is needed to build, read, or publish the site.

`scripts/import-mibsi-post.mjs` is optional conversion/verification tooling for
that historical import. It is never run by the normal build or deployment:
`node scripts/import-mibsi-post.mjs <original-bundle-directory> <output-file>`.
It verifies every embedded source against the original before writing. Running it
again overwrites the selected output file, so preserve editorial changes first.
