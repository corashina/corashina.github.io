import { useEffect } from "react";
import { useLocation } from "react-router-dom";
export function useBlogMetadata(pathname: string, title: string, description: string): void {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.replace(/\/$/, "") !== pathname) return;
    document.title = title;
    let element = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!element) { element = document.createElement("meta"); element.name = "description"; document.head.append(element); }
    element.content = description;
  }, [location.pathname, pathname, title, description]);
}
export const formatPostDate = (date: string): string =>
  new Intl.DateTimeFormat("en", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })
    .format(new Date(date + "T00:00:00Z"));
