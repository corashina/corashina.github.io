import type { JSX } from "react";
import { trackContactClick } from "../analytics/analytics";
import { cvLink, email, emailLink, gitHubLink, linkedInLink } from "../data/profile";
import styles from "../styles/layout.module.scss";

const footerLinks = [
  { ...emailLink, label: email },
  { ...cvLink, label: "CV" },
  linkedInLink,
  gitHubLink,
] as const;

export function Footer(): JSX.Element {
  return (
    <footer className={styles.footer}>
      <ul aria-label="Footer contact links" className={styles.footerLinks}>
        {footerLinks.map((link) => (
          <li key={link.method}>
            <a href={link.href} onClick={() => trackContactClick(link.method)}>
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <p>Copyright &copy; {new Date().getFullYear()} Tomasz Zielinski</p>
    </footer>
  );
}
