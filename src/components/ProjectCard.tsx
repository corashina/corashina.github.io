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
      aria-label={`${project.title}: ${project.summary}`}
      className={styles.card}
      to={`/works/${project.slug}`}
    >
      <ProjectMedia interactive media={project.media} />
      <h3>{project.title}</h3>
    </Link>
  );
}
