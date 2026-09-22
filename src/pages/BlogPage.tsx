import type { JSX } from "react";
import { Link } from "react-router-dom";
import { posts } from "../blog/catalog";
import { formatPostDate, useBlogMetadata } from "../blog/useBlogMetadata";
import styles from "../styles/blog.module.scss";

export function BlogPage(): JSX.Element {
  useBlogMetadata("/blog", "Blog | Tomasz Zielinski", "Articles and engineering notes by Tomasz Zielinski.");
  const orderedPosts = [...posts];
  const particlesIndex = orderedPosts.findIndex(post => post.slug === "sculpting-particles-with-persistent-forces");
  const assistantIndex = orderedPosts.findIndex(post => post.slug === "building-a-private-telegram-assistant");
  if (particlesIndex >= 0 && assistantIndex >= 0) {
    [orderedPosts[particlesIndex], orderedPosts[assistantIndex]] =
      [orderedPosts[assistantIndex], orderedPosts[particlesIndex]];
  }
  return <section className={styles.blog} aria-label="Blog posts">
    {posts.length === 0 ? <p>No articles published yet.</p> :
      <ol className={styles.posts}>{orderedPosts.map(post => <li key={post.slug} className={styles.post}>
        <time dateTime={post.date} className={styles.date}>{formatPostDate(post.date)}</time>
        <h2><Link to={"/blog/" + post.slug}>{post.title}</Link></h2>
        <p>{post.description}</p>
        {post.tags.length > 0 && <ul className={styles.tags} aria-label="Topics">{post.tags.map(tag=><li key={tag}>{tag}</li>)}</ul>}
        <Link className={styles.readLink} to={"/blog/" + post.slug} aria-label={"Read " + post.title}>Read article <span aria-hidden="true">↗</span></Link>
      </li>)}</ol>}
  </section>;
}
