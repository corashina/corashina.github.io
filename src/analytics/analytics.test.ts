import { afterEach, beforeEach, expect, it, vi } from "vitest";

const token = "d833a464098749e993ece3a34cb58c63";
let analytics: typeof import("./analytics");
const beacon = () => document.querySelector("#cloudflare-web-analytics");

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("VITE_CF_BEACON_TOKEN", token);
  vi.stubGlobal("window", { location: { hostname: "www.tomasz-zielinski.com" } });
  analytics = await import("./analytics");
});

afterEach(() => {
  beacon()?.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("loads the cookieless Cloudflare beacon once, with SPA tracking", () => {
  analytics.initializeAnalytics();
  analytics.initializeAnalytics();
  expect(document.querySelectorAll("#cloudflare-web-analytics")).toHaveLength(1);
  expect(beacon()).toHaveAttribute("src", "https://static.cloudflareinsights.com/beacon.min.js");
  expect(JSON.parse(beacon()!.getAttribute("data-cf-beacon")!)).toEqual({ token, spa: true });
});

it("does not load Google Analytics", () => {
  analytics.initializeAnalytics();
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});

it("stays off on other hosts", async () => {
  vi.resetModules();
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  (await import("./analytics")).initializeAnalytics();
  expect(beacon()).toBeNull();
});

it("stays off without a valid token", async () => {
  vi.resetModules();
  vi.stubEnv("VITE_CF_BEACON_TOKEN", "");
  (await import("./analytics")).initializeAnalytics();
  expect(beacon()).toBeNull();
});
