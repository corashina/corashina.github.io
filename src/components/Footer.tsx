import type { JSX } from "react";
import styles from "../styles/layout.module.scss";

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer}>
      <p>Copyright &copy; {new Date().getFullYear()} Tomasz Zielinski</p>
    </footer>
  );
}
