import type { JSX } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { projects } from "../data/projects";
import styles from "../styles/work.module.scss";

export function WorksPage(): JSX.Element {
  return (
    <section className={styles.workPage}>
      <h1>Work</h1>
      <h2>my stuff</h2>
      <div className={styles.grid}>
        {projects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
