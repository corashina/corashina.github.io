import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { ProjectMedia } from "../components/ProjectMedia";
import { getProjectBySlug, localizeProject } from "../data/projects";
import { useLocale } from "../i18n/useLocale";
import styles from "../styles/work.module.scss";
import { NotFoundPage } from "./NotFoundPage";

export function ProjectPage(): JSX.Element {
  const { slug } = useParams();
  const locale = useLocale();
  const found = slug ? getProjectBySlug(slug) : undefined;
  const project = found && localizeProject(found, locale);

  if (!project) {
    return <NotFoundPage />;
  }

  return (
    <article className={styles.detail}>
      <ProjectMedia interactive loadingMode="eager" media={project.media} />
      <div>
        <h2>{project.title}</h2>
        <h4><time dateTime={project.startedAt}>{project.startedLabel}</time></h4>
        <p>{project.description}</p>
        <br />
        <ul className={styles.tools}>
          {project.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
        <br />
        <a href={project.sourceUrl}>{project.sourceLabel}</a>
      </div>
    </article>
  );
}
