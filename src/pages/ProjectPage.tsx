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
      <ProjectMedia interactive media={project.media} />
      <div>
        <h2>{project.title}</h2>
        <h4>{project.date}</h4>
        <p>{project.description}</p>
        <br />
        <ul className={styles.tools}>
          {project.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
        <br />
        <a href={project.sourceUrl}>github →</a>
      </div>
    </article>
  );
}
