import type { JSX } from "react";
import { Link } from "react-router-dom";
import { posts } from "../blog/catalog";
import { formatPostDate, useBlogMetadata } from "../blog/useBlogMetadata";
import styles from "../styles/blog.module.scss";

export function BlogPage(): JSX.Element {
  useBlogMetadata("/blog", "Blog | Tomasz Zielinski", "Articles and engineering notes by Tomasz Zielinski.");
  return <section className={styles.blog} aria-label="Blog posts">
    {posts.length === 0 ? <p>No articles published yet.</p> :
      <ol className={styles.posts}>{posts.map(post => <li key={post.slug} className={styles.post}>
        <time dateTime={post.date} className={styles.date}>{formatPostDate(post.date)}</time>
        <h2><Link to={"/blog/" + post.slug}>{post.title}</Link></h2>
        <p>{post.description}</p>
        {post.tags.length > 0 && <ul className={styles.tags} aria-label="Topics">{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
        <Link className={styles.readLink} to={"/blog/" + post.slug} aria-label={"Read " + post.title}>Read article <span aria-hidden="true">↗</span></Link>
      </li>)}</ol>}
  </section>;
}
