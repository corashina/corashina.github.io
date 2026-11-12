import type { JSX } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { Theme } from "../theme/theme";
import styles from "../styles/layout.module.scss";
import { ThemeControl } from "./ThemeControl";

type NavigationProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

const links = [
  { label: "Home", to: "/", end: true },
  { label: "Work", to: "/works", end: true },
  { label: "Articles", to: "/blog", end: false },
  { label: "Contact", to: "/contact", end: true },
] as const;

export function Navigation({ theme, onToggleTheme }: NavigationProps): JSX.Element {
  const location = useLocation();

  return (
    <nav aria-label="Primary navigation" className={styles.navigation}>
      <ThemeControl onToggle={onToggleTheme} theme={theme} />
      <div className={styles.menu}>
        <ul>
          {links.map(({ end, label, to }) => (
            <li key={to}>
              <NavLink
                className={({ isActive }) => (isActive ? styles.active : undefined)}
                end={end}
                onClick={(event) => {
                  if ((location.pathname.replace(/\/$/, "") || "/") === to) {
                    event.preventDefault();
                  }
                }}
                to={to}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
