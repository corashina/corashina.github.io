import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  useNavigate,
  type NavigateFunction,
  type NavigationType,
} from "react-router-dom";
import { App } from "../app/App";
import styles from "../styles/layout.module.scss";
import { resolveTransitionDirection } from "./AppShell";

const sceneMocks = vi.hoisted(() => ({
  createBackgroundScene: vi.fn(),
}));

vi.mock("../three/backgroundScene", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../three/backgroundScene")>()),
  createBackgroundScene: sceneMocks.createBackgroundScene,
}));

describe("AppShell", () => {
  beforeEach(() => {
    sceneMocks.createBackgroundScene.mockReset();
    sceneMocks.createBackgroundScene.mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      resize: vi.fn(),
      setPointer: vi.fn(),
      setTheme: vi.fn(),
      renderStatic: vi.fn(),
      dispose: vi.fn(),
    });
    localStorage.clear();
    document.body.className = "";
    document.body.style.colorScheme = "";
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContextStub {});
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverStub {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    if (vi.isFakeTimers()) {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
    vi.unstubAllGlobals();
  });

  it("renders accessible navigation and closes the mobile menu after navigation", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    const canvas = screen.getByTestId("background-canvas");
    expect(canvas.compareDocumentPosition(navigation)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(navigation).getByRole("link", { name: "Home" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const menuButton = within(navigation).getByRole("button", {
      name: "Open navigation menu",
    });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(menuButton).toHaveAttribute("aria-controls", "primary-menu");

    await user.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    expect(menuButton).toHaveAccessibleName("Close navigation menu");

    await user.click(within(navigation).getByRole("link", { name: "Contact" }));
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it("always starts with the original dark theme", () => {
    localStorage.setItem("portfolio-theme", "white");
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(document.body).toHaveClass("dark");
  });

  it("toggles page and particle themes together without persistence", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(document.body).toHaveClass("dark");
    const themeButton = screen.getByRole("button", {
      name: "Switch to light theme",
    });

    await user.click(themeButton);

    expect(document.body).toHaveClass("white");
    expect(document.body).not.toHaveClass("dark");
    expect(document.body.style.colorScheme).toBe("light");
    const controller = sceneMocks.createBackgroundScene.mock.results[0]?.value;
    expect(controller.setTheme).toHaveBeenLastCalledWith(
      expect.objectContaining({ background: "#ffffff" }),
    );
    expect(localStorage.getItem("portfolio-theme")).not.toBe("white");
    expect(themeButton).toHaveAccessibleName("Switch to dark theme");
  });

  it("moves forward on initial and pushed routes and backward on later history pops", () => {
    expect(resolveTransitionDirection("POP" as NavigationType, "default")).toBe("forward");
    expect(resolveTransitionDirection("PUSH" as NavigationType, "pushed-location")).toBe(
      "forward",
    );
    expect(resolveTransitionDirection("POP" as NavigationType, "history-location")).toBe(
      "backward",
    );
  });

  it("runs the initial forward appearance for 500ms", () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const main = screen.getByRole("main");
    expect(main).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(499));
    expect(main).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(1));
    expect(main).not.toHaveClass(styles.forwardEnter, styles.forwardEnterActive);
  });

  it("keeps captured outlets during push and back transitions while hiding outgoing mains", () => {
    vi.useFakeTimers();
    let navigate: NavigateFunction | undefined;

    function RouterHarness() {
      navigate = useNavigate();
      return <App />;
    }

    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <RouterHarness />
      </MemoryRouter>,
    );
    act(() => vi.advanceTimersByTime(500));

    act(() => navigate?.("/works"));

    let mains = [...container.querySelectorAll("main")];
    expect(mains).toHaveLength(2);
    const homeExit = mains.find((main) => main.textContent?.includes("Tomasz Zielinski"));
    const workEnter = mains.find((main) => main.textContent?.includes("my stuff"));
    expect(homeExit).toHaveAttribute("aria-hidden", "true");
    expect(homeExit).toHaveAttribute("inert");
    expect(homeExit).toHaveClass(styles.forwardExit, styles.forwardExitActive);
    expect(workEnter).not.toHaveAttribute("aria-hidden");
    expect(workEnter).not.toHaveAttribute("inert");
    expect(workEnter).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Tomasz Zielinski" })).not.toBeInTheDocument();

    act(() => navigate?.("/contact"));
    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelectorAll("main")).toHaveLength(1);

    act(() => navigate?.(-1));

    mains = [...container.querySelectorAll("main")];
    expect(mains).toHaveLength(2);
    const contactExit = mains.find((main) => main.textContent?.includes("contact@zielin.ski"));
    const workEnterBack = mains.find((main) => main.textContent?.includes("my stuff"));
    expect(contactExit).toHaveAttribute("aria-hidden", "true");
    expect(contactExit).toHaveAttribute("inert");
    expect(contactExit).toHaveClass(styles.backwardExit, styles.backwardExitActive);
    expect(workEnterBack).not.toHaveAttribute("aria-hidden");
    expect(workEnterBack).not.toHaveAttribute("inert");
    expect(workEnterBack).toHaveClass(styles.backwardEnter, styles.backwardEnterActive);

    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Contact" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Work" })).toBeInTheDocument();
  });

  it("retains the original contact destinations, flair, and footer", () => {
    render(
      <MemoryRouter initialEntries={["/contact"]}>
        <App />
      </MemoryRouter>,
    );

    const links = screen.getByRole("list", { name: "Contact links" });
    expect(within(links).getByRole("link", { name: /contact@zielin\.ski/i })).toHaveAttribute(
      "href",
      "mailto:contact@zielin.ski",
    );
    expect(within(links).getByRole("link", { name: /resume/i })).toHaveAttribute(
      "href",
      "/tomasz_zielinski.pdf",
    );
    expect(within(links).getByRole("link", { name: /github/i })).toHaveAttribute(
      "href",
      "https://github.com/corashina",
    );
    expect(within(links).getByRole("link", { name: /stack overflow/i })).toHaveAttribute(
      "href",
      "https://stackoverflow.com/users/7306664/corashina?tab=profile",
    );
    expect(within(links).getByRole("link", { name: /linkedin/i })).toHaveAttribute(
      "href",
      "https://www.linkedin.com/in/tomasz-zielinski-a97999161/",
    );
    expect(within(links).getByRole("link", { name: /twitter/i })).toHaveAttribute(
      "href",
      "http://twitter.com/corashina",
    );
    const flair = screen.getByRole("link", { name: "Profile for corashina on Stack Exchange" });
    expect(flair).toHaveAttribute("href", "https://stackexchange.com/users/9864859");
    expect(within(flair).getByRole("img")).toHaveAttribute(
      "src",
      "https://stackexchange.com/users/flair/9864859.png?theme=default",
    );
    expect(within(flair).getByRole("img")).toHaveAttribute("width", "208");
    expect(within(flair).getByRole("img")).toHaveAttribute("height", "58");
    expect(
      screen.getByText(`Copyright © ${new Date().getFullYear()} Tomasz Zielinski`),
    ).toBeInTheDocument();
  });
});
