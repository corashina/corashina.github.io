import { useState, type JSX } from "react";
import {
  FaEnvelope,
  FaFile,
  FaGithub,
  FaLinkedin,
  FaStackOverflow,
} from "react-icons/fa";
import styles from "../styles/contact.module.scss";
import { useMessages } from "../i18n/useLocale";

export function ContactPage(): JSX.Element {
  const { contact } = useMessages();
  const [flairFailed, setFlairFailed] = useState(false);
  return (
    <>
      <h1>{contact.title}</h1>
      <section>
        <h2>{contact.findMe}</h2>
        <ul aria-label={contact.linksLabel} className={styles.contact}>
          <li>
            <a href="mailto:corashina@gmail.com">
              <FaEnvelope aria-hidden="true" />
              corashina@gmail.com
            </a>
          </li>
          <li>
            <a href={contact.cvHref}>
              <FaFile aria-hidden="true" />
              {contact.cv}
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
            <a href="https://www.linkedin.com/in/corashina/">
              <FaLinkedin aria-hidden="true" />
              linkedin <span>linkedin.com/in/corashina</span>
            </a>
          </li>
        </ul>
        {/* The flair is a hotlinked image; if Stack Exchange is unreachable, show nothing rather than alt text. */}
        {!flairFailed && (
          <a className={styles.flair} href="https://stackexchange.com/users/9864859">
            <img
              alt={contact.flairAlt}
              height="58"
              onError={() => setFlairFailed(true)}
              src="https://stackexchange.com/users/flair/9864859.png?theme=default"
              width="208"
            />
          </a>
        )}
      </section>
    </>
  );
}
