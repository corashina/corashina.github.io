import { useEffect, useRef, useState, type JSX, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { findPost, loadPostBody } from "../blog/catalog";
import { revealArticleFragment } from "../blog/articleFragments";
import { formatPostDate, useBlogMetadata } from "../blog/useBlogMetadata";
import type { PostBody } from "../blog/types";
import { NotFoundPage } from "./NotFoundPage";
import styles from "../styles/blog.module.scss";

type ArticleState = { slug: string; body?: PostBody; failed?: boolean };
export function BlogPostPage(): JSX.Element {
  const { slug = "" } = useParams();
  const post = findPost(slug);
  const location = useLocation();
  const navigate = useNavigate();
  const articleRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<ArticleState>({ slug });
  const [attempt, setAttempt] = useState(0);
  const body = state.slug === slug ? state.body : undefined;
  const failed = state.slug === slug && state.failed;
  useBlogMetadata("/blog/" + slug, post ? post.title + " | Tomasz Zielinski" : "404 | Tomasz Zielinski",
    post?.description ?? "This article could not be found.");

  useEffect(() => {
    if (!post) return;
    const controller = new AbortController();
    setState({ slug });
    loadPostBody(slug, controller.signal).then(
      body => { if (!controller.signal.aborted) setState({ slug, body }); },
      () => { if (!controller.signal.aborted) setState({ slug, failed: true }); },
    );
    return () => controller.abort();
  }, [slug, post, attempt]);

  useEffect(() => {
    if (!body || !articleRef.current || location.pathname.replace(/\/$/, "") !== "/blog/" + slug) return;
    if (location.hash) revealArticleFragment(articleRef.current, location.hash);
  }, [body, location.hash, location.key, location.pathname, slug]);

  const followFragment = (event: MouseEvent<HTMLElement>): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    const hash = anchor?.getAttribute("href");
    if (!hash || !articleRef.current || !revealArticleFragment(articleRef.current, hash)) return;
    event.preventDefault();
    if (hash !== location.hash) navigate({ pathname: location.pathname, search: location.search, hash });
  };

  if (!post) return <NotFoundPage />;
  return <section className={styles.articlePage} onClick={followFragment} aria-labelledby="article-title">
    <Link to="/blog" className={styles.backLink}><span aria-hidden="true">←</span> Back to blog</Link>
    <header className={styles.articleHeader}>
      <time dateTime={post.date} className={styles.date}>{formatPostDate(post.date)}</time>
      <h1 id="article-title">{post.title}</h1>
      <p className={styles.description}>{post.description}</p>
      {post.tags.length > 0 && <ul className={styles.tags} aria-label="Topics">{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
    </header>
    {!body && !failed && <p role="status">Loading article…</p>}
    {failed && <div role="alert" className={styles.error}><p>Unable to load this article. Please try again.</p>
      <button type="button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></div>}
    {body && <>
      <nav aria-label="Article contents" className={styles.contents}>
        <h2>In this article</h2>
        <ol>{body.headings.filter(heading=>heading.level === 2).map(heading=>
          <li key={heading.id}><a href={"#" + encodeURIComponent(heading.id)}>{heading.text}</a></li>)}</ol>
      </nav>
      <article ref={articleRef} className={styles.article} dangerouslySetInnerHTML={{__html:body.html}} />
      <Link to="/blog" className={styles.bottomLink}>← All articles</Link>
    </>}
  </section>;
}
