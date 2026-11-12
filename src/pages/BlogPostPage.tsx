import { useEffect, useRef, useState, type JSX, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { findPost, loadPostBody } from "../blog/catalog";
import { revealArticleFragment } from "../blog/articleFragments";
import { formatPostDate, useBlogMetadata } from "../blog/useBlogMetadata";
import type { PostBody } from "../blog/types";
import { siteName } from "../data/pageMeta";
import { useLocale, useLocalizedPath, useMessages } from "../i18n/useLocale";
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
  const locale = useLocale();
  const localize = useLocalizedPath();
  const { blog, meta } = useMessages();
  // Articles are written in English; mark them so on Polish pages.
  const articleLang = locale === "en" ? undefined : "en";
  const body = state.slug === slug ? state.body : undefined;
  const failed = state.slug === slug && state.failed;
  useBlogMetadata(localize("/blog/" + slug), (post ? post.title : meta.articleNotFoundTitle) + " | " + siteName,
    post?.description ?? blog.notFoundDescription);

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
    if (!body || !articleRef.current || location.pathname.replace(/\/$/, "") !== localize("/blog/" + slug)) return;
    if (location.hash) revealArticleFragment(articleRef.current, location.hash);
  }, [body, location.hash, location.key, location.pathname, slug, localize]);

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
    <Link to={localize("/blog")} className={styles.backLink}><span aria-hidden="true">←</span> {blog.backToArticles}</Link>
    <header className={styles.articleHeader}>
      <time dateTime={post.date} className={styles.date}>{formatPostDate(post.date, locale)}</time>
      <h1 id="article-title" lang={articleLang}>{post.title}</h1>
      <p className={styles.description} lang={articleLang}>{post.description}</p>
      {post.tags.length > 0 && <ul className={styles.tags} aria-label={blog.topics} lang={articleLang}>{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
    </header>
    {!body && !failed && <p role="status">{blog.loading}</p>}
    {failed && <div role="alert" className={styles.error}><p>{blog.loadFailed}</p>
      <button type="button" onClick={()=>setAttempt(value=>value+1)}>{blog.retry}</button></div>}
    {body && <>
      <nav aria-label={blog.contentsLabel} className={styles.contents}>
        <h2>{blog.contents}</h2>
        <ol lang={articleLang}>{body.headings.filter(heading=>heading.level === 2).map(heading=>
          <li key={heading.id}><a href={"#" + encodeURIComponent(heading.id)}>{heading.text}</a></li>)}</ol>
      </nav>
      <article ref={articleRef} className={styles.article} lang={articleLang} dangerouslySetInnerHTML={{__html:body.html}} />
      <Link to={localize("/blog")} className={styles.bottomLink}>← {blog.allArticles}</Link>
    </>}
  </section>;
}
