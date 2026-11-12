import type { JSX } from "react";
import { useMessages } from "../i18n/useLocale";
import type { Theme } from "../theme/theme";
import styles from "../styles/layout.module.scss";

type ThemeControlProps = {
  theme: Theme;
  onToggle: () => void;
};

export function ThemeControl({ theme, onToggle }: ThemeControlProps): JSX.Element {
  const messages = useMessages();

  return (
    <button
      aria-label={theme === "dark" ? messages.theme.toLight : messages.theme.toDark}
      className={styles.themeControl}
      onClick={onToggle}
      type="button"
    >
      <span aria-hidden="true" />
    </button>
  );
}
