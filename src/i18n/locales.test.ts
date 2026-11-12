import { describe, expect, it } from "vitest";
import { localeFromPath, localizePath, otherLocale, stripLocale } from "./locales";

describe("locale paths", () => {
  it.each([
    ["/", "en"],
    ["/works", "en"],
    ["/pl", "pl"],
    ["/pl/", "pl"],
    ["/pl/works/xelcode", "pl"],
    ["/plus", "en"],
    ["/players/pl", "en"],
  ])("reads the locale of %s", (path, locale) => {
    expect(localeFromPath(path)).toBe(locale);
  });

  it.each([
    ["/pl", "/"],
    ["/pl/", "/"],
    ["/pl/works", "/works"],
    ["/works", "/works"],
    ["/plus", "/plus"],
  ])("strips the locale from %s", (path, stripped) => {
    expect(stripLocale(path)).toBe(stripped);
  });

  it.each([
    ["/", "pl", "/pl"],
    ["/works", "pl", "/pl/works"],
    ["/pl/works", "pl", "/pl/works"],
    ["/pl/works", "en", "/works"],
    ["/pl", "en", "/"],
    ["/blog/post", "en", "/blog/post"],
  ] as const)("localizes %s to %s", (path, locale, localized) => {
    expect(localizePath(path, locale)).toBe(localized);
  });

  it("names the other locale", () => {
    expect(otherLocale("en")).toBe("pl");
    expect(otherLocale("pl")).toBe("en");
  });
});
