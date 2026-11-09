import type { JSX } from "react";
import { Link } from "react-router-dom";
import { trackContactClick } from "../analytics/analytics";
import {
  experience,
  featuredProjects,
  primaryLinks,
  toolkitGroups,
} from "../data/profile";
import styles from "../styles/home.module.scss";

export function HomePage(): JSX.Element {
  return (
    <div className={styles.home}>
      <section className={styles.introduction} aria-labelledby="home-title">
        <h1 id="home-title">Tomasz Zielinski</h1>
        <h2>full-stack developer · React, TypeScript, .NET</h2>
        <p>
          Full-stack developer with six years at Xelto, building React and TypeScript
          applications, .NET integrations, and React Native and Flutter mobile apps. My work
          covers warehouse and manufacturing scanning, approval workflows, Polish e-invoicing
          (KSeF), and document AI. I build both the interface and the API behind it, and I
          maintain the CI/CD pipelines and shared npm packages that ship them.
        </p>
        <p className={styles.availability}>Open to full-stack developer roles.</p>
        <ul aria-label="Get in touch" className={styles.actions}>
          {primaryLinks.map((link, index) => (
            <li key={link.method}>
              <a
                className={index === 0 ? styles.primaryAction : styles.action}
                href={link.href}
                onClick={() => trackContactClick(link.method)}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.experience} aria-labelledby="experience-title">
        <h2 id="experience-title">Experience</h2>
        <ol className={styles.timeline}>
          {experience.map((entry) => (
            <li key={`${entry.organisation}-${entry.period}`}>
              <span className={styles.timelineRole}>
                {entry.title} <span>· {entry.organisation}</span>
              </span>
              <span className={styles.timelinePeriod}>{entry.period}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.featured} aria-labelledby="featured-title">
        <h2 id="featured-title">Selected work</h2>
        <ul className={styles.featuredList}>
          {featuredProjects.map((project) => (
            <li key={project.slug}>
              <Link to={`/works/${project.slug}`}>{project.title} →</Link>
              <p>{project.evidence}</p>
            </li>
          ))}
        </ul>
        <Link className={styles.allWork} to="/works">
          All work →
        </Link>
      </section>

      <aside className={styles.toolkit} aria-labelledby="toolkit-title">
        <h2 id="toolkit-title">Toolkit</h2>
        {toolkitGroups.map((group) => (
          <section className={styles.toolkitGroup} key={group.title}>
            <h3>{group.title}</h3>
            <ul className={styles.toolList}>
              {group.technologies.map((technology) => (
                <li className={styles.toolPill} key={`${group.title}-${technology}`}>
                  {technology}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </aside>
    </div>
  );
}
