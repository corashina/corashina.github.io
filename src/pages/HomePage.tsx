import type { JSX } from "react";
import { Link } from "react-router-dom";
import { useLocalizedPath, useMessages } from "../i18n/useLocale";
import type { Messages } from "../i18n/messages";
import styles from "../styles/home.module.scss";

type ToolkitGroup = {
  title: keyof Pick<Messages["home"], "languages" | "platforms" | "systems" | "delivery">;
  technologies: readonly string[];
};

const toolkitGroups = [
  {
    title: "languages",
    technologies: ["TypeScript", "JavaScript", "C#", "SQL", "Kotlin", "Java", "XSLT/XML"],
  },
  {
    title: "platforms",
    technologies: ["React", "React Native/Expo", ".NET", "Node.js", "Android", "Flutter", "Three.js/WebGL"],
  },
  {
    title: "systems",
    technologies: ["SQL Server", "Azure", "REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    title: "delivery",
    technologies: ["GitHub Actions", "CI/CD", "npm packages", "Vite"],
  },
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
