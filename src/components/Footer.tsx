import type { JSX } from "react";
import { useMessages } from "../i18n/useLocale";
import styles from "../styles/layout.module.scss";

export function Footer(): JSX.Element {
  const { meta } = useMessages();
  return (
    <footer className={styles.footer}>
      <p>Copyright &copy; {new Date().getFullYear()} {meta.name}</p>
    </footer>
  );
}
