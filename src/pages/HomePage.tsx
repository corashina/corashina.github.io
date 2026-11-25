import type { JSX } from "react";
import { Link } from "react-router-dom";
import { useLocalizedPath, useMessages } from "../i18n/useLocale";
import type { Messages } from "../i18n/messages";
import styles from "../styles/home.module.scss";

// Mirrors the Technologies block of the CV (scripts/full_stack_cv_content.py).
type ToolkitGroup = {
  title: keyof Pick<Messages["home"], "frontend" | "mobile" | "backend" | "cloud" | "testing" | "delivery">;
  technologies: readonly string[];
};

const toolkitGroups = [
  { title: "frontend", technologies: ["TypeScript", "React", "Redux", "TanStack", "Mantine"] },
  { title: "mobile", technologies: ["React Native", "Expo", "Android (Java, Kotlin)"] },
  { title: "backend", technologies: ["C#/.NET", "SQL Server", "Node.js"] },
  { title: "cloud", technologies: ["Azure", "Firebase"] },
  { title: "testing", technologies: ["Playwright", "Vitest"] },
  { title: "delivery", technologies: ["GitHub Actions", "EAS"] },
] as const satisfies readonly ToolkitGroup[];

export function HomePage(): JSX.Element {
  const { home, meta, contact } = useMessages();
  const localize = useLocalizedPath();
  return (
    <div className={styles.home}>
      <section className={styles.introduction} aria-labelledby="home-title">
        <h1 id="home-title">{meta.name}</h1>
        <h2>{home.role}</h2>
        {home.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p className={styles.homeLinks}>
          <a href={contact.cvHref}>{home.cvLink}</a>
          <Link to={localize("/contact")}>{home.contactLink}</Link>
        </p>
      </section>

      <aside className={styles.toolkit} aria-labelledby="toolkit-title">
        <h2 id="toolkit-title">{home.toolkit}</h2>
        {toolkitGroups.map((group) => (
          <section className={styles.toolkitGroup} key={group.title}>
            <h3>{home[group.title]}</h3>
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
