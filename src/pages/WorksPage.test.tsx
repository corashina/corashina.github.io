import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorksPage } from "./WorksPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorksPage />
    </MemoryRouter>,
  );

const setReducedMotion = (matches: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches }),
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WorksPage", () => {
  it("renders all projects as single semantic links in order", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "commercial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "freelance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "experiments" })).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(13);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/works/xelapps",
      "/works/icr",
      "/works/workflow",
      "/works/holiday",
      "/works/einvoicing",
      "/works/xelcode",
      "/works/kiteprint",
      "/works/fitmed",
      "/works/particle-simulation",
      "/works/civio",
      "/works/flappy-pixie",
      "/works/endless-city",
      "/works/webgl-minecraft",
    ]);

    for (const link of links) {
      expect(within(link).queryByRole("link")).not.toBeInTheDocument();
      expect(within(link).getByText(link.getAttribute("aria-label") ?? "")).toBeInTheDocument();
    }
    const xelcode = screen.getByRole("link", { name: "Xelcode" });
    expect(within(xelcode).getByText("2021")).toHaveAttribute("dateTime", "2021");
    expect(within(xelcode).queryByText(/Started:/)).not.toBeInTheDocument();
  });

  it("plays video previews from card hover and keyboard focus, then pauses and resets them", async () => {
    setReducedMotion(false);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("autoplay blocked"));
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    renderPage();

    const card = screen.getByRole("link", { name: "Endless-City" });
    const video = within(card).getByLabelText("Infinite procedural WebGL city scene");
    Object.defineProperty(video, "currentTime", { configurable: true, value: 12, writable: true });

    fireEvent.mouseEnter(card);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(card);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(video).toHaveProperty("currentTime", 0);

    fireEvent.focus(card);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(2);

    Object.defineProperty(video, "currentTime", { configurable: true, value: 8, writable: true });
    fireEvent.blur(card);
    expect(pause).toHaveBeenCalledTimes(2);
    expect(video).toHaveProperty("currentTime", 0);
  });

  it("plays video previews even when reduced motion is reported", async () => {
    setReducedMotion(true);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    renderPage();

    const card = screen.getByRole("link", { name: "Endless-City" });
    fireEvent.mouseEnter(card);
    fireEvent.focus(card);
    await Promise.resolve();

    expect(play).toHaveBeenCalledTimes(2);
  });

  it("removes video interactions immediately when the media falls back", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const { unmount } = renderPage();
    const card = screen.getByRole("link", { name: "Endless-City" });
    const video = within(card).getByLabelText("Infinite procedural WebGL city scene");
    const removeEventListener = vi.spyOn(card, "removeEventListener");

    fireEvent.error(video);

    expect(within(card).getByText("Infinite procedural WebGL city scene")).toBeInTheDocument();
    expect(card.querySelector("video")).not.toBeInTheDocument();
    expect(removeEventListener).toHaveBeenCalledTimes(4);

    fireEvent.mouseEnter(card);
    fireEvent.focus(card);
    expect(play).not.toHaveBeenCalled();

    unmount();
    expect(removeEventListener).toHaveBeenCalledTimes(4);
  });

  it("shows the original alt text when project media fails", () => {
    renderPage();

    const card = screen.getByRole("link", { name: "Fitmed" });
    const image = within(card).getByRole("img", { name: "Fitmed interface" });

    fireEvent.error(image);

    expect(within(card).getByText("Fitmed interface")).toBeInTheDocument();
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  });
});
