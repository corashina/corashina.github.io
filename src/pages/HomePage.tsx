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
            I build web and mobile applications for operations, approvals, document processing,
            and ERP-connected workflows. My work spans React and TypeScript interfaces, reusable
            component systems, native mobile clients, .NET services, and automation tooling.
          </p>
          <p>
            I focus on software that turns complex business rules into clear, reliable toolsâ€”from
            scanner-led warehouse processes and editable document workflows to e-invoicing,
            integrations, and WebGL experiments.
          </p>
        </div>
        <Skills />
      </div>
    </>
  );
}
