// Shared by the app and by the build step that writes one HTML file per route
// (scripts/create-route-pages.mjs). Keep runtime imports out of this file.

export const locales = ["en", "pl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

const polishPrefix = /^\/pl(?=\/|$)/;

/** English lives at the root; Polish lives under /pl. */
export const localeFromPath = (pathname: string): Locale =>
  polishPrefix.test(pathname) ? "pl" : "en";

/** Returns the English (unprefixed) form of a path. */
export const stripLocale = (pathname: string): string =>
  pathname.replace(polishPrefix, "") || "/";

/** Returns the path for the given locale, whatever locale the input is in. */
export const localizePath = (pathname: string, locale: Locale): string => {
  const path = stripLocale(pathname);
  if (locale === "en") return path;
  return path === "/" ? "/pl" : "/pl" + path;
};

export const otherLocale = (locale: Locale): Locale => (locale === "en" ? "pl" : "en");
