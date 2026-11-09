import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { initializeAnalytics } from "./analytics/analytics";
import { normalizeTrailingSlash } from "./app/normalizeTrailingSlash";
import "./styles/global.scss";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

normalizeTrailingSlash(window.location, window.history);
initializeAnalytics();

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
