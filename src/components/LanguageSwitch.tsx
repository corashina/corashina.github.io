import type { JSX } from "react";
import { Link, useLocation } from "react-router-dom";
import { localizePath, otherLocale } from "../i18n/locales";
import { useLocale, useMessages } from "../i18n/useLocale";
import styles from "../styles/layout.module.scss";

/** Links to the same page in the other language, keeping query and fragment. */
export function LanguageSwitch(): JSX.Element {
  const { pathname, search, hash } = useLocation();
  const target = otherLocale(useLocale());
  const { language } = useMessages();

  return (
    <Link
      aria-label={language.switchLabel}
      className={styles.languageSwitch}
      hrefLang={target}
      lang={target}
      to={localizePath(pathname, target) + search + hash}
    >
      {language.switchText}
    </Link>
  );
}
