import type { JSX } from "react";
import {
  FaEnvelope,
  FaFile,
  FaGithub,
  FaLinkedin,
  FaStackOverflow,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import styles from "../styles/contact.module.scss";
import { trackContactClick } from "../analytics/analytics";
import { cvUrl, email, gitHubLink, linkedInLink } from "../data/profile";

export function ContactPage(): JSX.Element {
  return (
    <>
      <h1>Contact</h1>
      <section>
        <h2>find me</h2>
        <p className={styles.lead}>
          Open to full-stack developer roles. Email is the fastest way to reach me.
        </p>
        <ul aria-label="Contact links" className={styles.contact}>
          <li>
            <a href={`mailto:${email}`} onClick={() => trackContactClick("email")}>
              <FaEnvelope aria-hidden="true" />
              {email}
            </a>
          </li>
          <li>
            <a href={cvUrl} onClick={() => trackContactClick("cv")}>
              <FaFile aria-hidden="true" />
              CV <span>PDF</span>
            </a>
          </li>
          <li>
            <a href={linkedInLink.href} onClick={() => trackContactClick("linkedin")}>
              <FaLinkedin aria-hidden="true" />
              linkedin <span>linkedin.com/in/tomasz-zielinski</span>
            </a>
          </li>
          <li>
            <a href={gitHubLink.href} onClick={() => trackContactClick("github")}>
              <FaGithub aria-hidden="true" />
              github <span>github.com/corashina</span>
            </a>
          </li>
          <li className={styles.socialStart}>
            <a href="https://stackoverflow.com/users/7306664/corashina?tab=profile" onClick={() => trackContactClick("stackoverflow")}>
              <FaStackOverflow aria-hidden="true" />
              stack overflow <span>stackoverflow.com/corashina</span>
            </a>
          </li>
          <li>
            <a href="https://x.com/corashina" onClick={() => trackContactClick("x")}>
              <FaXTwitter aria-hidden="true" />
              x <span>x.com/corashina</span>
            </a>
          </li>
        </ul>
      </section>
    </>
  );
}
