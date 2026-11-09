import type { JSX } from "react";
import { Link, useParams } from "react-router-dom";
import { trackContactClick } from "../analytics/analytics";
import { findPost } from "../blog/catalog";
import { ProjectMedia } from "../components/ProjectMedia";
import { getProjectBySlug } from "../data/projects";
import { cvUrl, email } from "../data/profile";
import styles from "../styles/work.module.scss";
import { NotFoundPage } from "./NotFoundPage";

export function ProjectPage(): JSX.Element {
  const { slug } = useParams();
  const project = slug ? getProjectBySlug(slug) : undefined;

  if (!project) {
    return <NotFoundPage />;
  }

  const writeUps = project.writeUps.flatMap((postSlug) => {
    const post = findPost(postSlug);
    return post ? [post] : [];
  });

  return (
    <article className={styles.detail}>
      <ProjectMedia interactive loadingMode="eager" media={project.media} />
      <div className={styles.detailText}>
        <h1>{project.title}</h1>
        <p className={styles.detailMeta}>
          {project.category === "commercial" ? "Xelto · " : ""}
          <time dateTime={project.startedAt}>{project.date}</time>
        </p>
        <p>{project.description}</p>
        {project.role ? (
          <section aria-labelledby="project-role">
            <h2 id="project-role">What I built</h2>
            <p>{project.role}</p>
          </section>
        ) : null}
        <ul aria-label="Stack" className={styles.tools}>
          {project.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
        {writeUps.length > 0 ? (
          <section aria-labelledby="project-write-ups">
            <h2 id="project-write-ups">Write-up</h2>
            <ul className={styles.writeUps}>
              {writeUps.map((post) => (
                <li key={post.slug}>
                  <Link to={`/blog/${post.slug}`}>{post.title} →</Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p>
          <a href={project.sourceUrl}>{project.sourceLabel}</a>
        </p>
        <p className={styles.hireLine}>
          Hiring for work like this?{" "}
          <a href={`mailto:${email}`} onClick={() => trackContactClick("email")}>
            Email me
          </a>{" "}
          or{" "}
          <a href={cvUrl} onClick={() => trackContactClick("cv")}>
            download my CV
          </a>
          .
        </p>
      </div>
    </article>
  );
}
