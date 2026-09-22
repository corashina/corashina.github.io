export function revealArticleFragment(root: HTMLElement, hash: string): boolean {
  if (!hash || hash === "#") return false;
  let id: string;
  try { id = decodeURIComponent(hash.replace(/^#/, "")); } catch { return false; }
  const target = [...root.querySelectorAll<HTMLElement>("[id]")].find(element => element.id === id);
  if (!target) return false;
  let node: HTMLElement | null = target;
  while (node && root.contains(node)) {
    if (node instanceof HTMLDetailsElement) node.open = true;
    node = node.parentElement;
  }
  target.scrollIntoView?.({ block: "start", behavior: "instant" });
  return true;
}
