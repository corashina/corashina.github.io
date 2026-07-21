import { useState, type JSX } from "react";
import { GoRows as GoThreeBars, GoX } from "react-icons/go";
import { NavLink } from "react-router-dom";
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
  { label: "Contact", to: "/contact", end: true },
] as const;

export function Navigation({ theme, onToggleTheme }: NavigationProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const menuLabel = expanded ? "Close navigation menu" : "Open navigation menu";

  return (
    <nav aria-label="Primary navigation" className={styles.navigation}>
      <ThemeControl onToggle={onToggleTheme} theme={theme} />
      <button
        aria-controls="primary-menu"
        aria-expanded={expanded}
        aria-label={menuLabel}
        className={styles.menuToggle}
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        {expanded ? <GoX aria-hidden="true" /> : <GoThreeBars aria-hidden="true" />}
      </button>
      <div
        className={`${styles.menu} ${expanded ? styles.menuExpanded : ""}`}
        id="primary-menu"
      >
        <ul>
          {links.map(({ end, label, to }) => (
            <li key={to}>
              <NavLink
                className={({ isActive }) => (isActive ? styles.active : undefined)}
                end={end}
                onClick={(event) => {
                  setExpanded(false);
                  if (event.currentTarget.getAttribute("aria-current") === "page") {
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
