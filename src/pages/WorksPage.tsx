import type { JSX } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { projects } from "../data/projects";
import styles from "../styles/work.module.scss";

export function WorksPage(): JSX.Element {
  const commercialProjects = projects.filter((project) => project.category === "commercial");
  const experiments = projects.filter((project) => project.category === "experiments");

  return (
    <section className={styles.workPage}>
      <h1>Work</h1>
      <h2>Commercial work</h2>
      <div className={styles.grid}>
        {commercialProjects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
      <h2>Experiments</h2>
      <div className={styles.grid}>
        {experiments.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
