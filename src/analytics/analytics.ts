export type ContactMethod = "email" | "github" | "linkedin" | "stackoverflow" | "twitter" | "stackexchange";

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const productionHosts = new Set([
  "www.tomasz-zielinski.com",
  "tomasz-zielinski.com",
  "corashina.github.io",
]);

type GoogleTag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: GoogleTag;
  }
}

let initialized = false;

function isAnalyticsEnabled(): boolean {
  return import.meta.env.PROD &&
    typeof measurementId === "string" && /^G-[A-Z0-9]+$/.test(measurementId) &&
    productionHosts.has(window.location.hostname);
}

export function initializeAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  const analyticsWindow = window;

  initialized = true;
  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.gtag = function () {
    analyticsWindow.dataLayer!.push(arguments);
  };
  const gtag = analyticsWindow.gtag;
  gtag("js", new Date());
  gtag("config", measurementId, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    cookie_domain: "none",
    cookie_path: "/",
  });

  // Enhanced measurement owns initial/history page views, downloads and outbound
  // links. Do not also send page_view events from React Router.
  const script = document.createElement("script");
  script.id = "google-analytics";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);
}

export function trackContactClick(method: ContactMethod): void {
  if (!initialized || !isAnalyticsEnabled()) return;
  window.gtag?.("event", "contact_click", {
    contact_method: method,
    transport_type: "beacon",
  });
}
