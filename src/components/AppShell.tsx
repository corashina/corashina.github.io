import {
  cloneElement,
  createRef,
  useEffect,
  useMemo,
  useRef,
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

type TransitionHistory = {
  currentKey: string;
  direction: TransitionDirection;
  entries: string[];
  index: number;
};

const createTransitionHistory = (locationKey: string): TransitionHistory => ({
  currentKey: locationKey,
  direction: "forward",
  entries: [locationKey],
  index: 0,
});

const resolveTransitionDirection = (
  navigationType: NavigationType,
  locationKey: string,
  history: TransitionHistory,
): TransitionDirection => {
  if (locationKey === history.currentKey) return history.direction;

  if (navigationType === "PUSH") {
    history.entries.splice(history.index + 1);
    history.entries.push(locationKey);
    history.index = history.entries.length - 1;
    history.direction = "forward";
  } else if (navigationType === "REPLACE") {
    history.entries[history.index] = locationKey;
    history.direction = "forward";
  } else {
    const knownIndex = history.entries.indexOf(locationKey);
    if (knownIndex >= 0) {
      history.direction = knownIndex < history.index ? "backward" : "forward";
      history.index = knownIndex;
    } else {
      history.entries.splice(history.index, 0, locationKey);
      history.direction = "backward";
    }
  }

  history.currentKey = locationKey;
  return history.direction;
};

export function AppShell(): JSX.Element {
  const location = useLocation();
  const navigationType = useNavigationType();
  const outlet = useOutlet();
  const nodeRef = useMemo(() => createRef<HTMLElement>(), [location.key]);
  const transitionHistoryRef = useRef<TransitionHistory | null>(null);
  const [theme, setTheme] = useState<Theme>("dark");

  if (transitionHistoryRef.current === null) {
    transitionHistoryRef.current = createTransitionHistory(location.key);
  }

  useEffect(() => {
    applyTheme(theme, document.body);
  }, [theme]);

  useEffect(() => {
    const path = location.pathname.split("/").filter((segment) => segment !== "").pop() ?? "Home";
    document.title = path.charAt(0).toUpperCase() + path.slice(1);
  }, [location.pathname]);

  const isWorkRoute = location.pathname === "/works" || location.pathname.startsWith("/works/");
  const direction = resolveTransitionDirection(
    navigationType,
    location.key,
    transitionHistoryRef.current,
  );
  const appearClasses: CSSTransitionClassNames = {
    appear: styles.forwardEnter,
    appearActive: styles.forwardEnterActive,
  };
  const transitionClasses: CSSTransitionClassNames =
    direction === "forward"
      ? {
          ...appearClasses,
          enter: styles.forwardEnter,
          enterActive: styles.forwardEnterActive,
          exit: styles.forwardExit,
          exitActive: styles.forwardExitActive,
        }
      : {
          ...appearClasses,
          enter: styles.backwardEnter,
          enterActive: styles.backwardEnterActive,
          exit: styles.backwardExit,
          exitActive: styles.backwardExitActive,
        };
  const showRoute = (): void => {
    nodeRef.current?.removeAttribute("aria-hidden");
    nodeRef.current?.removeAttribute("inert");
  };
  const hideRoute = (): void => {
    nodeRef.current?.setAttribute("aria-hidden", "true");
    nodeRef.current?.setAttribute("inert", "");
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
            appear
            classNames={transitionClasses}
            key={location.key}
            nodeRef={nodeRef}
            onEnter={showRoute}
            onExit={hideRoute}
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
