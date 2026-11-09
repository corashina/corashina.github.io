import type { JSX } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { projects } from "../data/projects";
import styles from "../styles/work.module.scss";

const experimentEndOrder: Readonly<Record<string, number>> = {
  civio: 1,
  "particle-simulation": 2,
};

export function WorksPage(): JSX.Element {
  const commercialProjects = projects.filter((project) => project.category === "commercial");
  const freelanceProjects = projects.filter((project) => project.category === "freelance");
  const experiments = projects
    .filter((project) => project.category === "experiments")
    .sort(
      (first, second) =>
        (experimentEndOrder[first.slug] ?? 0) - (experimentEndOrder[second.slug] ?? 0),
    );

  return (
    <section className={styles.workPage}>
      <h1>Work</h1>
      <h2>commercial</h2>
      <div className={styles.grid}>
        {commercialProjects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
      <h2>freelance</h2>
      <div className={styles.grid}>
        {freelanceProjects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
      <h2>experiments</h2>
      <div className={styles.grid}>
        {experiments.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
