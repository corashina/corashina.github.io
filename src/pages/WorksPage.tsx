import type { JSX } from "react";
import { ProjectCard } from "../components/ProjectCard";
import { localizeProject, projects } from "../data/projects";
import { useLocale, useMessages } from "../i18n/useLocale";
import styles from "../styles/work.module.scss";

const experimentEndOrder: Readonly<Record<string, number>> = {
  civio: 1,
  "particle-simulation": 2,
};

export function WorksPage(): JSX.Element {
  const locale = useLocale();
  const { works } = useMessages();
  const localized = projects.map((project) => localizeProject(project, locale));
  const commercialProjects = localized.filter((project) => project.category === "commercial");
  const freelanceProjects = localized.filter((project) => project.category === "freelance");
  const experiments = localized
    .filter((project) => project.category === "experiments")
    .sort(
      (first, second) =>
        (experimentEndOrder[first.slug] ?? 0) - (experimentEndOrder[second.slug] ?? 0),
    );

  return (
    <section className={styles.workPage}>
      <h1>{works.title}</h1>
      <h2>{works.commercial}</h2>
      <div className={styles.grid}>
        {commercialProjects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
      <h2>{works.freelance}</h2>
      <div className={styles.grid}>
        {freelanceProjects.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
      <h2>{works.experiments}</h2>
      <div className={styles.grid}>
        {experiments.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </section>
  );
}
