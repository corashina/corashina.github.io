import type { JSX } from "react";
import { useMessages } from "../i18n/useLocale";
import styles from "../styles/home.module.scss";

export function HomePage(): JSX.Element {
  const { home, meta } = useMessages();
  return (
    <div className={styles.home}>
      <section className={styles.introduction} aria-labelledby="home-title">
        <h1 id="home-title">{meta.name}</h1>
        <h2>{home.role}</h2>
        {home.intro.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </section>
    </div>
  );
}
