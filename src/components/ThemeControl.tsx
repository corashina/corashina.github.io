import type { JSX } from "react";
import type { Theme } from "../theme/theme";
import styles from "../styles/layout.module.scss";

type ThemeControlProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeControl({ theme, onToggle }: ThemeControlProps): JSX.Element {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      aria-label={`Switch to ${nextTheme} theme`}
      className={styles.themeControl}
      onClick={onToggle}
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}
