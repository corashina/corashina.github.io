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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;

    if (!interactive || !container || !video) {
      return;
    }

    const target = container.closest("a") ?? container;
    const play = () => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      video.play()?.catch(() => {});
    };
    const reset = () => {
      video.pause();
      video.currentTime = 0;
    };

    target.addEventListener("mouseenter", play);
    target.addEventListener("mouseleave", reset);
    target.addEventListener("focus", play);
    target.addEventListener("blur", reset);

    return () => {
      target.removeEventListener("mouseenter", play);
      target.removeEventListener("mouseleave", reset);
      target.removeEventListener("focus", play);
      target.removeEventListener("blur", reset);
    };
  }, [interactive, media.kind]);

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
        <img alt={media.alt} onError={() => setFailed(true)} src={media.src} />
      ) : (
        <video
          aria-label={media.alt}
          loop
          muted
          onError={() => setFailed(true)}
          playsInline
          preload="metadata"
          ref={videoRef}
          src={media.src}
        />
      )}
    </span>
  );
}
