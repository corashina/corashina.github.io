import { useEffect, useRef, useState, type JSX } from "react";
import type { ProjectMedia as ProjectMediaData } from "../data/projects";
import styles from "../styles/work.module.scss";

type ProjectMediaProps = {
  media: ProjectMediaData;
  interactive: boolean;
};

export function ProjectMedia({ media, interactive }: ProjectMediaProps): JSX.Element {
  const containerRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupInteractionsRef = useRef<(() => void) | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    let video = videoRef.current;

    if (!interactive || !container || !video) {
      return;
    }

    const target = container.closest("a") ?? container;
    const play = () => {
      video?.play()?.catch(() => {});
    };
    const reset = () => {
      if (!video) return;
      video.pause();
      video.currentTime = 0;
    };
    let cleaned = false;

    const cleanupInteractions = () => {
      if (cleaned) return;
      cleaned = true;
      target.removeEventListener("mouseenter", play);
      target.removeEventListener("mouseleave", reset);
      target.removeEventListener("focus", play);
      target.removeEventListener("blur", reset);
      video = null;
      if (cleanupInteractionsRef.current === cleanupInteractions) {
        cleanupInteractionsRef.current = null;
      }
    };

    target.addEventListener("mouseenter", play);
    target.addEventListener("mouseleave", reset);
    target.addEventListener("focus", play);
    target.addEventListener("blur", reset);
    cleanupInteractionsRef.current = cleanupInteractions;

    return cleanupInteractions;
  }, [interactive, media.kind]);

  const handleError = () => {
    cleanupInteractionsRef.current?.();
    setFailed(true);
  };

  if (failed) {
    return (
      <span className={`${styles.media} ${styles.mediaFallback}`} ref={containerRef}>
        {media.alt}
      </span>
    );
  }

  return (
    <span className={styles.media} ref={containerRef}>
      {media.kind === "image" ? (
        <img alt={media.alt} onError={handleError} src={media.src} />
      ) : (
        <video
          aria-label={media.alt}
          loop
          muted
          onError={handleError}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={media.src}
        />
      )}
    </span>
  );
}
