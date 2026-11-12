import type { JSX } from "react";
import { Link } from "react-router-dom";
import { posts } from "../blog/catalog";
import { formatPostDate, useBlogMetadata } from "../blog/useBlogMetadata";
import { articlesMeta } from "../data/pageMeta";
import { useLocale, useLocalizedPath, useMessages } from "../i18n/useLocale";
import styles from "../styles/blog.module.scss";

export function BlogPage(): JSX.Element {
  const locale = useLocale();
  const localize = useLocalizedPath();
  const { blog } = useMessages();
  const meta = articlesMeta(locale);
  useBlogMetadata(localize("/blog"), meta.title, meta.description);
  // Articles are written in English; mark them so on Polish pages.
  const articleLang = locale === "en" ? undefined : "en";
  const orderedPosts = [...posts];
  const particlesIndex = orderedPosts.findIndex(post => post.slug === "sculpting-particles-with-persistent-forces");
  const assistantIndex = orderedPosts.findIndex(post => post.slug === "building-a-private-telegram-assistant");
  if (particlesIndex >= 0 && assistantIndex >= 0) {
    [orderedPosts[particlesIndex], orderedPosts[assistantIndex]] =
      [orderedPosts[assistantIndex], orderedPosts[particlesIndex]];
  }
  return <section className={styles.blog} aria-label={blog.label}>
    {posts.length === 0 ? <p>{blog.empty}</p> :
      <ol className={styles.posts}>{orderedPosts.map(post => <li key={post.slug} className={styles.post}>
        <time dateTime={post.date} className={styles.date}>{formatPostDate(post.date, locale)}</time>
        <h2 lang={articleLang}><Link to={localize("/blog/" + post.slug)}>{post.title}</Link></h2>
        <p lang={articleLang}>{post.description}</p>
        {post.tags.length > 0 && <ul className={styles.tags} aria-label={blog.topics} lang={articleLang}>{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
        <Link className={styles.readLink} to={localize("/blog/" + post.slug)} aria-label={blog.readArticleLabel + " " + post.title}>{blog.readArticle} <span aria-hidden="true">↗</span></Link>
      </li>)}</ol>}
  </section>;
}
