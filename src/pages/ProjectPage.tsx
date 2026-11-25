import type { JSX } from "react";
import { useParams } from "react-router-dom";
import { ProjectMedia } from "../components/ProjectMedia";
import { getProjectBySlug, localizeProject } from "../data/projects";
import { useLocale, useMessages } from "../i18n/useLocale";
import styles from "../styles/work.module.scss";
import { NotFoundPage } from "./NotFoundPage";

export function ProjectPage(): JSX.Element {
  const { slug } = useParams();
  const locale = useLocale();
  const { works } = useMessages();
  const found = slug ? getProjectBySlug(slug) : undefined;
  const project = found && localizeProject(found, locale);

  if (!project) {
    return <NotFoundPage />;
  }

  return (
    <article className={styles.detail}>
      <ProjectMedia interactive loadingMode="eager" media={project.media} />
      <div>
        <h1 className={styles.detailTitle}>{project.title}</h1>
        <p className={styles.detailYear}><time dateTime={project.startedAt}>{project.startedLabel}</time></p>
        <p>{project.description}</p>
        <br />
        <ul className={styles.tools}>
          {project.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
        <br />
        <p className={styles.links}>
          <a href={project.sourceUrl}>{project.sourceLabel}</a>
          {project.demoUrl && <a href={project.demoUrl}>{works.playLink}</a>}
        </p>
      </div>
    </article>
  );
}
