import type { JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useLocalizedPath, useMessages } from "../i18n/useLocale";
import type { Theme } from "../theme/theme";
import styles from "../styles/layout.module.scss";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeControl } from "./ThemeControl";

type NavigationProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

const links = [
  { key: "home", to: "/", end: true },
  { key: "work", to: "/works", end: true },
  { key: "articles", to: "/blog", end: false },
  { key: "contact", to: "/contact", end: true },
] as const;

export function Navigation({ theme, onToggleTheme }: NavigationProps): JSX.Element {
  const location = useLocation();
  const messages = useMessages();
  const localize = useLocalizedPath();

  return (
    <nav aria-label={messages.nav.label} className={styles.navigation}>
      <div className={styles.controls}>
        <LanguageSwitch />
        <ThemeControl onToggle={onToggleTheme} theme={theme} />
      </div>
      <div className={styles.menu}>
        <ul>
          {links.map(({ end, key, to }) => {
            const target = localize(to);
            return (
              <li key={to}>
                <NavLink
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                  end={end}
                  onClick={(event) => {
                    if ((location.pathname.replace(/\/$/, "") || "/") === target) {
                      event.preventDefault();
                    }
                  }}
                  to={target}
                >
                  {messages.nav[key]}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
