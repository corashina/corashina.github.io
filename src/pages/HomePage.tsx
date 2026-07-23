import type { JSX } from "react";
import styles from "../styles/home.module.scss";

type ToolkitGroup = {
  title: string;
  technologies: readonly string[];
};

const toolkitGroups = [
  {
    title: "Languages",
    technologies: ["TypeScript", "JavaScript", "C#", "Dart", "XSLT/XML", "GLSL"],
  },
  {
    title: "Platforms",
    technologies: [".NET", "Node.js", "React", "React Native/Expo", "Flutter", "Three.js/WebGL"],
  },
  {
    title: "Systems",
    technologies: ["REST APIs", "JWT", "n8n", "Oracle JD Edwards"],
  },
  {
    title: "Delivery",
    technologies: ["GitHub Actions", "CI/CD", "npm packages", "Vite"],
  },
] as const satisfies readonly ToolkitGroup[];

export function HomePage(): JSX.Element {
  return (
    <div className={styles.home}>
      <section className={styles.introduction} aria-labelledby="home-title">
        <h1 id="home-title">Tomasz Zielinski</h1>
        <h2>Full-Stack Developer</h2>
        <p>
          I build platforms for business workflows, operational systems, mobile applications,
          integrations, and document processing. I work across TypeScript, C#, Dart, and XSLT,
          connecting user-facing products with APIs, data flows, cloud services, and delivery
          pipelines.
        </p>
        <p>
          My experience covers logistics, manufacturing, workflow automation, e-invoicing, and
          document AI. I take products from application architecture through integration and
          release. I also build WebGL side projects with Three.js.
        </p>
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
