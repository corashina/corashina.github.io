import { useEffect, useState, type JSX } from "react";
import { Outlet, useLocation } from "react-router-dom";
import styles from "../styles/layout.module.scss";
import {
  applyTheme,
  getLocalStorage,
  persistTheme,
  readInitialTheme,
  type Theme,
} from "../theme/theme";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { Footer } from "./Footer";
import { Navigation } from "./Navigation";

export function AppShell(): JSX.Element {
  const location = useLocation();
  const [storage] = useState(() => getLocalStorage(window));
  const [theme, setTheme] = useState<Theme>(() =>
    readInitialTheme(
      storage,
      window.matchMedia?.("(prefers-color-scheme: light)").matches ?? false,
    ),
  );

  useEffect(() => {
    applyTheme(theme, document.body);
    persistTheme(storage, theme);
  }, [storage, theme]);

  const isWorkRoute = location.pathname === "/works" || location.pathname.startsWith("/works/");

  return (
    <div className={`${styles.layout} ${isWorkRoute ? styles.workLayout : ""}`}>
      <BackgroundCanvas theme={theme} />
      <Navigation
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "white" : "dark"))}
        theme={theme}
      />
      <main className={styles.route} key={location.pathname}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
