import { useEffect, useRef, useState, type JSX } from "react";
import type { ProjectMedia as ProjectMediaData } from "../data/projects";
import styles from "../styles/work.module.scss";
import { useDeferredMedia, type MediaLoadingMode } from "./useDeferredMedia";

type ProjectMediaProps = {
  media: ProjectMediaData;
  interactive: boolean;
  loadingMode: MediaLoadingMode;
};

export function ProjectMedia({
  media,
  interactive,
  loadingMode,
}: ProjectMediaProps): JSX.Element {
  const containerRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cleanupInteractionsRef = useRef<(() => void) | null>(null);
  const playRequestedRef = useRef(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const reducedMotion = typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const { active, activate } = useDeferredMedia({
    containerRef,
    enabled: media.kind === "video" && !videoFailed,
    eager: media.kind === "video" && loadingMode === "eager",
    reducedMotion,
  });

  useEffect(() => {
    const container = containerRef.current;
    let video = videoRef.current;

    if (
      media.kind !== "video"
      || !interactive
      || reducedMotion
      || videoFailed
      || !container
      || !video
    ) {
      return;
    }

    const target = container.closest("a") ?? container;
    const play = () => {
      playRequestedRef.current = true;
      activate();
      if (active) {
        video?.play()?.catch(() => {});
      }
    };
    const reset = () => {
      playRequestedRef.current = false;
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
  }, [activate, active, interactive, media.kind, reducedMotion, videoFailed]);

  useEffect(() => {
    const video = videoRef.current;
    if (!active || !playRequestedRef.current || !video || videoFailed || reducedMotion) return;
    video.play()?.catch(() => {});
  }, [active, reducedMotion, videoFailed]);

  if (media.kind === "image") {
    if (imageFailed) {
      return (
        <span className={`${styles.media} ${styles.mediaFallback}`} ref={containerRef}>
          {media.alt}
        </span>
      );
    }

    return (
      <span className={styles.media} ref={containerRef}>
        <img
          alt={media.alt}
          decoding="async"
          loading={loadingMode === "eager" ? "eager" : "lazy"}
          onError={() => setImageFailed(true)}
          src={media.src}
        />
      </span>
    );
  }

  const showVideo = videoLoaded && !videoFailed;
  const showFallback = posterFailed && !showVideo;
  const handleVideoError = () => {
    playRequestedRef.current = false;
    cleanupInteractionsRef.current?.();
    setVideoLoaded(false);
    setVideoFailed(true);
  };

  return (
    <span
      className={`${styles.media} ${showFallback ? styles.mediaFallback : ""}`}
      ref={containerRef}
    >
      {!posterFailed && (
        <img
          alt={media.alt}
          className={`${styles.mediaPoster} ${
            showVideo ? styles.mediaPosterHidden : ""
          }`}
          decoding="async"
          loading={loadingMode === "eager" ? "eager" : "lazy"}
          onError={() => setPosterFailed(true)}
          src={media.posterSrc}
        />
      )}
      {showFallback && media.alt}
      <video
        aria-label={media.alt}
        className={`${styles.mediaVideo} ${
          showVideo ? styles.mediaVideoLoaded : ""
        }`}
        controls={reducedMotion && loadingMode === "eager"}
        loop
        muted
        onError={handleVideoError}
        onLoadedData={() => {
          if (!videoFailed) setVideoLoaded(true);
        }}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={active ? media.src : undefined}
      />
    </span>
  );
}
