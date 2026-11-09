/**
 * GitHub Pages serves each prerendered route from <route>/index.html and
 * redirects /works to /works/. The app's routes and active links use paths
 * without the trailing slash, so drop it before the router starts.
 */
export function normalizeTrailingSlash(location: Location, history: History): void {
  const { pathname, search, hash } = location;
  if (pathname.length <= 1 || !pathname.endsWith("/")) return;
  const normalized = pathname.replace(/\/+$/, "") || "/";
  history.replaceState(history.state, "", normalized + search + hash);
}
