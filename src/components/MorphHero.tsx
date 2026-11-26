import { useEffect, useRef, type JSX } from "react";
import { SHAPES, morphStateAt } from "../hero/morphShapes";
import styles from "../styles/home.module.scss";

const PARTICLE_COUNT = 2_400;
const PERSPECTIVE = 2.8;
const FOLLOW = 0.085;
const REPEL_RADIUS = 50;
const TAU = Math.PI * 2;

type Particle = {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  highlight: boolean;
};

const createParticles = (): Particle[] =>
  Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 2 - 1,
    size: 0.6 + Math.random() * 1.1,
    phase: Math.random() * TAU,
    highlight: Math.random() < 0.06,
  }));

/** A particle cloud that flows between a sphere, torus, knot, cube and double helix. */
export function MorphHero(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const particles = createParticles();
    const pointer = { x: 0, y: 0, inside: false, pixelX: -9_999, pixelY: -9_999 };
    const tilt = { x: 0, y: 0 };
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame: number | null = null;
    let startTime: number | null = null;
    let colors = { ink: "#729ece", highlight: "#bbdcff", light: false };
    let frameCount = 0;

    const readColors = (): void => {
      const style = getComputedStyle(canvas);
      colors = {
        ink: style.getPropertyValue("--hero-ink").trim() || colors.ink,
        highlight: style.getPropertyValue("--hero-hot").trim() || colors.highlight,
        light: document.body.classList.contains("white"),
      };
    };

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    };

    const draw = (now: number): void => {
      frame = window.requestAnimationFrame(draw);
      startTime ??= now;
      const seconds = (now - startTime) / 1_000;
      if (frameCount++ % 30 === 0) readColors();

      tilt.x += ((pointer.inside ? pointer.y * 0.5 : 0) - tilt.x) * 0.05;
      tilt.y += ((pointer.inside ? pointer.x * 0.8 : 0) - tilt.y) * 0.05;
      const rotationY = seconds * 0.25 + tilt.y;
      const rotationX = 0.35 + tilt.x;
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);
      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const scale = Math.min(width, height) * 0.42;

      const { from, to, progress } = morphStateAt(seconds);
      const fromShape = SHAPES[from];
      const toShape = SHAPES[to];
      const wobble = Math.sin(progress * Math.PI) * 0.18;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = colors.light ? "source-over" : "lighter";

      particles.forEach((particle, index) => {
        const a = fromShape(index, PARTICLE_COUNT);
        const b = toShape(index, PARTICLE_COUNT);
        const targetX = a[0] + (b[0] - a[0]) * progress + Math.sin(particle.phase + seconds) * wobble;
        const targetY = a[1] + (b[1] - a[1]) * progress + Math.cos(particle.phase * 1.3 + seconds) * wobble;
        const targetZ = a[2] + (b[2] - a[2]) * progress;
        particle.x += (targetX - particle.x) * FOLLOW;
        particle.y += (targetY - particle.y) * FOLLOW;
        particle.z += (targetZ - particle.z) * FOLLOW;

        const rotatedX = particle.x * cosY - particle.z * sinY;
        const rotatedZ = particle.x * sinY + particle.z * cosY;
        const projectedY = particle.y * cosX - rotatedZ * sinX;
        const depthZ = particle.y * sinX + rotatedZ * cosX;
        const perspective = PERSPECTIVE / (PERSPECTIVE + depthZ);
        let screenX = width / 2 + rotatedX * scale * perspective;
        let screenY = height / 2 + projectedY * scale * perspective;

        const dx = screenX - pointer.pixelX;
        const dy = screenY - pointer.pixelY;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < REPEL_RADIUS * REPEL_RADIUS) {
          const distance = Math.sqrt(distanceSquared) || 1;
          const push = (1 - distanceSquared / (REPEL_RADIUS * REPEL_RADIUS)) * 12;
          screenX += (dx / distance) * push;
          screenY += (dy / distance) * push;
        }

        const nearness = Math.max(0, Math.min(1, (1 - depthZ) / 2));
        const size = particle.size * perspective * 1.25;
        context.globalAlpha = colors.light ? 0.35 + nearness * 0.55 : 0.22 + nearness * 0.6;
        context.fillStyle = particle.highlight ? colors.highlight : colors.ink;
        context.fillRect(screenX - size / 2, screenY - size / 2, size, size);
      });

      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
    };

    const start = (): void => {
      if (frame === null) frame = window.requestAnimationFrame(draw);
    };
    const stop = (): void => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.pixelX = event.clientX - rect.left;
      pointer.pixelY = event.clientY - rect.top;
      pointer.inside = true;
    };
    const onPointerLeave = (): void => {
      pointer.inside = false;
      pointer.pixelX = -9_999;
      pointer.pixelY = -9_999;
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") stop();
      else start();
    };

    readColors();
    resize();
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(canvas);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      stop();
      resizeObserver?.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div className={styles.hero} aria-hidden="true">
      <canvas className={styles.heroCanvas} data-testid="morph-hero" ref={canvasRef} />
    </div>
  );
}
