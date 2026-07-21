import { detectCapabilities } from "./app/capabilities";
import "./styles.css";

const canvas = document.querySelector<HTMLCanvasElement>("#showcase-canvas");

if (canvas === null) {
  throw new Error("The showcase canvas is missing.");
}

const capabilities = detectCapabilities(canvas, window.matchMedia.bind(window));
document.documentElement.dataset.showcaseState = capabilities.webgl2 ? "loading" : "fallback";
