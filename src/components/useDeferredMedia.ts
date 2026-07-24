import { useCallback, useEffect, useState, type RefObject } from "react";

export type MediaLoadingMode = "viewport" | "eager";

export function useDeferredMedia(options: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  eager: boolean;
}): { active: boolean; activate(): void } {
  const { containerRef, enabled, eager } = options;
  const [active, setActive] = useState(eager);
  const activate = useCallback(() => {
    setActive(true);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (
      !enabled
      || active
      || !container
      || typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    let disconnected = false;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      activate();
      disconnect();
    }, { rootMargin: "200px" });
    const disconnect = () => {
      if (disconnected) return;
      disconnected = true;
      observer.disconnect();
    };

    observer.observe(container);
    return disconnect;
  }, [activate, active, containerRef, enabled]);

  return { active, activate };
}
