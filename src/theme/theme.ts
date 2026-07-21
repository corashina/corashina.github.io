export type Theme = "dark" | "white";

export function applyTheme(theme: Theme, root: HTMLElement): void {
  root.classList.remove("dark", "white");
  root.classList.add(theme);
  root.style.colorScheme = theme === "white" ? "light" : "dark";
}
