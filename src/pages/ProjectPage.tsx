import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { ProjectMedia } from "../components/ProjectMedia";
import { getProjectBySlug } from "../data/projects";
import styles from "../styles/work.module.scss";
import { NotFoundPage } from "./NotFoundPage";

export function ProjectPage(): JSX.Element {
  const { slug } = useParams();
  const project = slug ? getProjectBySlug(slug) : undefined;

  if (!project) {
    return <NotFoundPage />;
  }

  return (
    <article className={styles.detail}>
      <ProjectMedia interactive={false} media={project.media} />
      <div className={styles.detailCopy}>
        <h1>{project.title}</h1>
        <p>{project.overview}</p>
        <section aria-label="Selected contribution">
          <h2>Selected contribution</h2>
          <ul className={styles.contributions}>
            {project.contributions.map((contribution) => (
              <li key={contribution}>{contribution}</li>
            ))}
          </ul>
        </section>
        <section aria-label="Technologies">
          <h2>Technologies</h2>
          <ul className={styles.tags}>
            {project.technologies.map((technology) => (
              <li key={technology}>{technology}</li>
            ))}
          </ul>
        </section>
        {project.sourceUrl && project.sourceLabel ? (
          <a href={project.sourceUrl}>{project.sourceLabel}</a>
        ) : null}
      </div>
    </article>
  );
}
