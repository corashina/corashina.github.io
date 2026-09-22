import { afterEach, beforeEach, expect, it, vi } from "vitest";

const measurementId = "G-XN363XBN6Z";
let analytics: typeof import("./analytics");
let browser: {
  location: { hostname: string };
  dataLayer?: IArguments[];
};
const commands = (): unknown[][] => browser.dataLayer?.map((args) => Array.from(args)) ?? [];

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_GA_MEASUREMENT_ID", measurementId);
  browser = { location: { hostname: "www.tomasz-zielinski.com" } };
  vi.stubGlobal("window", browser);
  analytics = await import("./analytics");
});

afterEach(() => {
  document.querySelector("#google-analytics")?.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("starts automatically without stored consent and initializes only once", () => {
  analytics.initializeAnalytics();
  analytics.initializeAnalytics();
  expect(document.querySelectorAll("#google-analytics")).toHaveLength(1);
  expect(document.querySelector("#google-analytics")).toHaveAttribute(
    "src", `https://www.googletagmanager.com/gtag/js?id=${measurementId}`,
  );
  expect(commands()).toEqual([
    ["js", expect.any(Date)],
    ["config", measurementId, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_domain: "none", cookie_path: "/",
    }],
  ]);
});

it("records a contact click after automatic initialization", () => {
  analytics.initializeAnalytics();
  analytics.trackContactClick("email");
  expect(commands().at(-1)).toEqual(["event", "contact_click", {
    contact_method: "email", transport_type: "beacon",
  }]);
});

it.each(["localhost", "127.0.0.1", "preview.example.com"])("does not track on %s", (hostname) => {
  browser.location.hostname = hostname;
  analytics.initializeAnalytics();
  analytics.trackContactClick("github");
  expect(document.querySelector("#google-analytics")).toBeNull();
  expect(commands()).toEqual([]);
});

it("does not track development builds even on a production hostname", () => {
  vi.stubEnv("PROD", false);
  analytics.initializeAnalytics();
  expect(document.querySelector("#google-analytics")).toBeNull();
});

it("does not install a tag when its measurement ID is missing", async () => {
  vi.stubEnv("VITE_GA_MEASUREMENT_ID", "");
  vi.resetModules();
  const unconfigured = await import("./analytics");
  unconfigured.initializeAnalytics();
  expect(document.querySelector("#google-analytics")).toBeNull();
});
