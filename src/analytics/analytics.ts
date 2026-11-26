// Cloudflare Web Analytics: a cookieless page-view counter, so the site needs
// no consent banner. It counts page views and SPA navigations only; there are
// no custom events.
const beaconToken = import.meta.env.VITE_CF_BEACON_TOKEN as string | undefined;
const productionHosts = new Set([
  "corashina.github.io",
]);

let initialized = false;

function isAnalyticsEnabled(): boolean {
  return import.meta.env.PROD &&
    typeof beaconToken === "string" && /^[0-9a-f]{32}$/.test(beaconToken) &&
    productionHosts.has(window.location.hostname);
}

export function initializeAnalytics(): void {
  if (initialized || !isAnalyticsEnabled()) return;
  initialized = true;
  const script = document.createElement("script");
  script.id = "cloudflare-web-analytics";
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.dataset.cfBeacon = JSON.stringify({ token: beaconToken, spa: true });
  document.head.appendChild(script);
}
