import {
  cloneElement,
  createRef,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactElement,
} from "react";
import {
  useLocation,
  useNavigationType,
  useOutlet,
  type NavigationType,
} from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";
import type { CSSTransitionClassNames } from "react-transition-group/CSSTransition";
import styles from "../styles/layout.module.scss";
import { applyTheme, type Theme } from "../theme/theme";
import { BackgroundCanvas } from "./BackgroundCanvas";
import { Footer } from "./Footer";
import { Navigation } from "./Navigation";

export type TransitionDirection = "forward" | "backward";

export const resolveTransitionDirection = (
  navigationType: NavigationType,
  locationKey: string,
): TransitionDirection =>
  navigationType === "POP" && locationKey !== "default" ? "backward" : "forward";

export function AppShell(): JSX.Element {
  const location = useLocation();
  const navigationType = useNavigationType();
  const outlet = useOutlet();
  const nodeRef = useMemo(() => createRef<HTMLElement>(), [location.key]);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    applyTheme(theme, document.body);
  }, [theme]);

  const isWorkRoute = location.pathname === "/works" || location.pathname.startsWith("/works/");
  const direction = resolveTransitionDirection(navigationType, location.key);
  const transitionClasses: CSSTransitionClassNames =
    direction === "forward"
      ? {
          enter: styles.forwardEnter,
          enterActive: styles.forwardEnterActive,
          exit: styles.forwardExit,
          exitActive: styles.forwardExitActive,
        }
      : {
          enter: styles.backwardEnter,
          enterActive: styles.backwardEnterActive,
          exit: styles.backwardExit,
          exitActive: styles.backwardExitActive,
        };

  return (
    <div className={`${styles.layout} ${isWorkRoute ? styles.workLayout : ""}`}>
      <BackgroundCanvas theme={theme} />
      <Navigation
        onToggleTheme={() => setTheme((current) => (current === "dark" ? "white" : "dark"))}
        theme={theme}
      />
      <div className={styles.routeStage}>
        <TransitionGroup
          component={null}
          childFactory={(child) =>
            cloneElement(
              child as ReactElement<{ classNames?: CSSTransitionClassNames }>,
              { classNames: transitionClasses },
            )
          }
        >
          <CSSTransition
            classNames={transitionClasses}
            key={location.key}
            nodeRef={nodeRef}
            timeout={500}
            unmountOnExit
          >
            <main className={styles.route} ref={nodeRef}>
              {outlet}
            </main>
          </CSSTransition>
        </TransitionGroup>
      </div>
      <Footer />
    </div>
  );
}
