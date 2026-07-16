import type { JSX } from "react";
import { Skills } from "../components/Skills";
import styles from "../styles/home.module.scss";

export function HomePage(): JSX.Element {
  return (
    <>
      <h1>Tomasz Zielinski</h1>
      <div className={styles.home}>
        <div className={styles.copy}>
          <h2>a full-stack software engineer</h2>
          <p>
            I build web and mobile software for operational workflows, business platforms,
            integrations, and document-heavy systems. My work covers React and TypeScript
            interfaces, API and ERP integrations, mobile applications, e-invoicing, and document
            AI.
          </p>
          <p>
            I work across product UI, backend services, and delivery tooling to turn complex
            processes into software people can use under real working conditions.
          </p>
        </div>
        <Skills />
      </div>
    </>
  );
}
