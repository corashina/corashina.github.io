import type { JSX } from "react";
import { Link } from "react-router-dom";
import type { Project } from "../data/projects";
import styles from "../styles/work.module.scss";
import { ProjectMedia } from "./ProjectMedia";

type ProjectCardProps = {
  project: Project;
};

export function ProjectCard({ project }: ProjectCardProps): JSX.Element {
  return (
    <Link
      aria-label={project.title}
      className={styles.card}
      to={`/works/${project.slug}`}
    >
      <ProjectMedia interactive loadingMode="viewport" media={project.media} />
      <span className={styles.cardHeader}>
        <span className={styles.cardTitle}>{project.title}</span>
        <time dateTime={project.startedAt}>{project.startedLabel}</time>
      </span>
    </Link>
  );
}
