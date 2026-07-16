export type Theme = "dark" | "white";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function getLocalStorage(
  owner: Pick<Window, "localStorage">,
): Storage | undefined {
  try {
    return owner.localStorage;
  } catch {
    return undefined;
  }
}

export function readInitialTheme(
  storage: ReadableStorage | undefined,
  prefersLight: boolean,
): Theme {
  let stored: string | null = null;
  try {
    stored = storage?.getItem("portfolio-theme") ?? null;
  } catch {
    // Storage can be unavailable in privacy modes or restricted embeds.
  }

  return stored === "dark" || stored === "white"
    ? stored
    : prefersLight
      ? "white"
      : "dark";
}

export function persistTheme(
  storage: WritableStorage | undefined,
  theme: Theme,
): void {
  try {
    storage?.setItem("portfolio-theme", theme);
  } catch {
    // Applying the in-memory theme should not depend on storage availability.
  }
}

export function applyTheme(theme: Theme, root: HTMLElement): void {
  root.classList.remove("dark", "white");
  root.classList.add(theme);
  root.style.colorScheme = theme === "white" ? "light" : "dark";
}
