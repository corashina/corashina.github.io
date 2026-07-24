import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  useNavigate,
  type NavigateFunction,
} from "react-router-dom";
import { App } from "../app/App";
import styles from "../styles/layout.module.scss";

const sceneMocks = vi.hoisted(() => ({
  createBackgroundScene: vi.fn(),
}));

const waitForPageHeading = async (name: string) => {
  let heading = screen.queryByRole("heading", { name });
  for (let attempt = 0; !heading && attempt < 10; attempt += 1) {
    await act(async () => {
      await Promise.resolve();
    });
    heading = screen.queryByRole("heading", { name });
  }
  expect(heading).toBeInTheDocument();
};

vi.mock("../three/backgroundScene", () => ({
  createBackgroundScene: sceneMocks.createBackgroundScene,
  normalizePointer: vi.fn(),
  normalizePointerSpeed: vi.fn(),
}));

let idleCallback: IdleRequestCallback;

async function flushBackgroundIdle(): Promise<void> {
  await act(async () => {
    idleCallback({
      didTimeout: false,
      timeRemaining: () => 20,
    });
    await Promise.resolve();
  });
}

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
      "requestIdleCallback",
      vi.fn((callback: IdleRequestCallback) => {
        idleCallback = callback;
        return 41;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
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
    window.history.replaceState(null, "", window.location.href);
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
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });

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
    expect(await screen.findByRole("heading", { name: "Contact" })).toBeInTheDocument();
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });

  it.each([
    ["/works/webgl-minecraft", "Work", "WebGL-Minecraft"],
    ["/contact/missing", "Contact", "404"],
  ])("does not mark %s parent navigation as current", async (path, linkName, heading) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: heading });

    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(within(navigation).getByRole("link", { name: linkName })).not.toHaveAttribute(
      "aria-current",
    );
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

  it("keeps the shared shell class stable between Home and Work", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });
    const initialClassName = container.firstElementChild?.className;

    await user.click(screen.getByRole("link", { name: "Work" }));
    await screen.findByRole("heading", { name: "Work" });

    expect(container.firstElementChild).toHaveClass(styles.layout);
    expect(container.firstElementChild?.className).toBe(initialClassName);
  });

  it("does not start a route transition when the active navigation link is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <MemoryRouter initialEntries={["/works"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Work" });

    await user.click(screen.getByRole("link", { name: "Work" }));

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.getByRole("main")).not.toHaveClass(styles.forwardExitActive);
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
    await flushBackgroundIdle();

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

  it.each([
    ["/", "Home"],
    ["/works", "Works"],
    ["/contact", "Contact"],
    ["/works/webgl-minecraft", "Webgl-minecraft"],
    ["/works/particle-simulation", "Particle-simulation"],
    ["/missing-page", "Missing-page"],
  ])("derives the document title for %s from the final pathname segment", (path, title) => {
    document.title = "stale title";

    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    );

    expect(document.title).toBe(title);
  });

  it("updates the exact original document title after navigation", async () => {
    let navigate: NavigateFunction | undefined;

    function RouterHarness() {
      navigate = useNavigate();
      return <App />;
    }

    render(
      <MemoryRouter initialEntries={["/"]}>
        <RouterHarness />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });
    expect(document.title).toBe("Home");

    await act(async () => navigate?.("/works/webgl-minecraft"));

    expect(document.title).toBe("Webgl-minecraft");
  });

  it("uses backward classes for browser Back and forward classes for browser Forward", async () => {
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
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(500));
    await act(async () => navigate?.("/works"));
    await waitForPageHeading("Work");
    act(() => vi.advanceTimersByTime(500));
    await act(async () => navigate?.("/contact"));
    await waitForPageHeading("Contact");
    act(() => vi.advanceTimersByTime(500));

    await act(async () => navigate?.(-1));
    await waitForPageHeading("Work");

    let mains = [...container.querySelectorAll("main")];
    const contactExit = mains.find((main) => main.textContent?.includes("corashina@gmail.com"));
    const workEnter = mains.find((main) => main.textContent?.includes("commercial"));
    expect(contactExit).toHaveClass(styles.backwardExit, styles.backwardExitActive);
    expect(workEnter).toHaveClass(styles.backwardEnter, styles.backwardEnterActive);

    act(() => vi.advanceTimersByTime(500));
    await act(async () => navigate?.(1));
    await waitForPageHeading("Contact");

    mains = [...container.querySelectorAll("main")];
    const workExit = mains.find((main) => main.textContent?.includes("commercial"));
    const contactEnter = mains.find((main) => main.textContent?.includes("corashina@gmail.com"));
    expect(workExit).toHaveClass(styles.forwardExit, styles.forwardExitActive);
    expect(contactEnter).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);
  });

  it("uses browser history indices for an unknown Forward POP from an initial middle entry", async () => {
    window.history.replaceState({ idx: 11 }, "", window.location.href);
    let navigate: NavigateFunction | undefined;

    function RouterHarness() {
      navigate = useNavigate();
      return <App />;
    }

    const { container } = render(
      <MemoryRouter initialEntries={["/", "/works", "/contact"]} initialIndex={1}>
        <RouterHarness />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Work" });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(500));

    await act(async () => {
      window.history.replaceState({ idx: 12 }, "", window.location.href);
      navigate?.(1);
    });
    await waitForPageHeading("Contact");

    const mains = [...container.querySelectorAll("main")];
    const workExit = mains.find((main) => main.textContent?.includes("commercial"));
    const contactEnter = mains.find((main) => main.textContent?.includes("corashina@gmail.com"));
    expect(workExit).toHaveClass(styles.forwardExit, styles.forwardExitActive);
    expect(contactEnter).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);
  });

  it("uses forward classes for replace and a deterministic backward fallback for unknown pops", async () => {
    let navigate: NavigateFunction | undefined;

    function RouterHarness() {
      navigate = useNavigate();
      return <App />;
    }

    const { container } = render(
      <MemoryRouter initialEntries={["/", "/works"]} initialIndex={1}>
        <RouterHarness />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Work" });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(500));

    await act(async () => navigate?.(-1));
    await waitForPageHeading("Tomasz Zielinski");

    let mains = [...container.querySelectorAll("main")];
    const workExit = mains.find((main) => main.textContent?.includes("commercial"));
    const homeEnter = mains.find((main) => main.textContent?.includes("Tomasz Zielinski"));
    expect(workExit).toHaveClass(styles.backwardExit, styles.backwardExitActive);
    expect(homeEnter).toHaveClass(styles.backwardEnter, styles.backwardEnterActive);

    act(() => vi.advanceTimersByTime(500));
    await act(async () => navigate?.("/contact", { replace: true }));
    await waitForPageHeading("Contact");

    mains = [...container.querySelectorAll("main")];
    const homeExit = mains.find((main) => main.textContent?.includes("Tomasz Zielinski"));
    const contactEnter = mains.find((main) => main.textContent?.includes("corashina@gmail.com"));
    expect(homeExit).toHaveClass(styles.forwardExit, styles.forwardExitActive);
    expect(contactEnter).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);
  });

  it("runs the initial forward appearance for 500ms", async () => {
    vi.useFakeTimers();
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    await waitForPageHeading("Tomasz Zielinski");

    const main = screen.getByRole("main");
    expect(main).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(499));
    expect(main).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(1));
    expect(main).not.toHaveClass(styles.forwardEnter, styles.forwardEnterActive);
  });

  it("keeps captured outlets during push and back transitions while hiding outgoing mains", async () => {
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
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(500));

    await act(async () => navigate?.("/works"));
    await waitForPageHeading("Work");

    let mains = [...container.querySelectorAll("main")];
    expect(mains).toHaveLength(2);
    const homeExit = mains.find((main) => main.textContent?.includes("Tomasz Zielinski"));
    const workEnter = mains.find((main) => main.textContent?.includes("commercial"));
    expect(homeExit).toHaveAttribute("aria-hidden", "true");
    expect(homeExit).toHaveAttribute("inert");
    expect(homeExit).toHaveClass(styles.forwardExit, styles.forwardExitActive);
    expect(workEnter).not.toHaveAttribute("aria-hidden");
    expect(workEnter).not.toHaveAttribute("inert");
    expect(workEnter).toHaveClass(styles.forwardEnter, styles.forwardEnterActive);

    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Tomasz Zielinski" })).not.toBeInTheDocument();

    await act(async () => navigate?.("/contact"));
    await waitForPageHeading("Contact");
    act(() => vi.advanceTimersByTime(500));
    expect(container.querySelectorAll("main")).toHaveLength(1);

    await act(async () => navigate?.(-1));
    await waitForPageHeading("Work");

    mains = [...container.querySelectorAll("main")];
    expect(mains).toHaveLength(2);
    const contactExit = mains.find((main) => main.textContent?.includes("corashina@gmail.com"));
    const workEnterBack = mains.find((main) => main.textContent?.includes("commercial"));
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

  it("restores accessibility when a route re-enters before its PUSH exit settles", async () => {
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
    await screen.findByRole("heading", { name: "Tomasz Zielinski" });
    vi.useFakeTimers();
    act(() => vi.advanceTimersByTime(500));

    await act(async () => navigate?.("/works"));
    await waitForPageHeading("Work");
    await act(async () => navigate?.(-1));
    await waitForPageHeading("Tomasz Zielinski");

    let restoredHome = [...container.querySelectorAll("main")].find((main) =>
      main.textContent?.includes("Tomasz Zielinski"),
    );
    expect(restoredHome).toBeDefined();
    expect(restoredHome).not.toHaveAttribute("aria-hidden");
    expect(restoredHome).not.toHaveAttribute("inert");

    act(() => vi.advanceTimersByTime(500));

    expect(container.querySelectorAll("main")).toHaveLength(1);
    restoredHome = container.querySelector("main") ?? undefined;
    expect(restoredHome).not.toHaveAttribute("aria-hidden");
    expect(restoredHome).not.toHaveAttribute("inert");
  });

  it("renders the current contact address, flair, and footer", async () => {
    render(
      <MemoryRouter initialEntries={["/contact"]}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole("heading", { name: "Contact" });

    const links = screen.getByRole("list", { name: "Contact links" });
    expect(within(links).getByRole("link", { name: /corashina@gmail\.com/i })).toHaveAttribute(
      "href",
      "mailto:corashina@gmail.com",
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
