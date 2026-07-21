import type { JSX } from "react";
import {
  FaEnvelope,
  FaFile,
  FaGithub,
  FaLinkedin,
  FaStackOverflow,
  FaTwitter,
} from "react-icons/fa";
import styles from "../styles/contact.module.scss";

export function ContactPage(): JSX.Element {
  return (
    <>
      <h1>Contact</h1>
      <section>
        <h2>find me</h2>
        <ul aria-label="Contact links" className={styles.contact}>
          <li>
            <a href="mailto:corashina@gmail.com">
              <FaEnvelope aria-hidden="true" />
              corashina@gmail.com
            </a>
          </li>
          <li>
            <a href="/tomasz_zielinski.pdf">
              <FaFile aria-hidden="true" />
              resume
            </a>
          </li>
          <li className={styles.socialStart}>
            <a href="https://github.com/corashina">
              <FaGithub aria-hidden="true" />
              github <span>github.com/corashina</span>
            </a>
          </li>
          <li>
            <a href="https://stackoverflow.com/users/7306664/corashina?tab=profile">
              <FaStackOverflow aria-hidden="true" />
              stack overflow <span>stackoverflow.com/corashina</span>
            </a>
          </li>
          <li>
            <a href="https://www.linkedin.com/in/tomasz-zielinski-a97999161/">
              <FaLinkedin aria-hidden="true" />
              linkedin <span>linkedin.com/in/tomasz-zielinski</span>
            </a>
          </li>
          <li>
            <a href="http://twitter.com/corashina">
              <FaTwitter aria-hidden="true" />
              twitter <span>twitter.com/corashina</span>
            </a>
          </li>
        </ul>
        <a className={styles.flair} href="https://stackexchange.com/users/9864859">
          <img
            alt="Profile for corashina on Stack Exchange"
            height="58"
            src="https://stackexchange.com/users/flair/9864859.png?theme=default"
            width="208"
          />
        </a>
      </section>
    </>
  );
}
