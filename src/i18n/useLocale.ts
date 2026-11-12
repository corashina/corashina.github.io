import { createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { localeFromPath, localizePath, type Locale } from "./locales";
import { messagesFor, type Messages } from "./messages";

/**
 * Pins the language of a rendered page. The shell wraps each route in it so a
 * page that is sliding out after a language switch keeps its own language.
 */
const PageLocaleContext = createContext<Locale | null>(null);
export const PageLocaleProvider = PageLocaleContext.Provider;

/** The URL is the only source of truth for the language. */
export const useLocale = (): Locale => {
  const pinned = useContext(PageLocaleContext);
  const { pathname } = useLocation();
  return pinned ?? localeFromPath(pathname);
};

export const useMessages = (): Messages => messagesFor(useLocale());

/** Returns a function that turns an English path into the current language's path. */
export const useLocalizedPath = (): ((path: string) => string) => {
  const locale = useLocale();
  return (path) => localizePath(path, locale);
};
