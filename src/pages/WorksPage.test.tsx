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
  it("renders the original projects as single semantic links in order", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "my stuff" })).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/works/webgl-minecraft",
      "/works/endless-city",
      "/works/flappy-pixie",
      "/works/civio",
      "/works/particle-simulation",
      "/works/fitmed",
      "/works/kiteprint",
    ]);

    for (const link of links) {
      expect(within(link).queryByRole("link")).not.toBeInTheDocument();
      expect(within(link).getByText(link.getAttribute("aria-label") ?? "")).toBeInTheDocument();
    }
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

  it("does not play video previews when reduced motion is requested", () => {
    setReducedMotion(true);
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    renderPage();

    const card = screen.getByRole("link", { name: "Endless-City" });
    fireEvent.mouseEnter(card);
    fireEvent.focus(card);

    expect(play).not.toHaveBeenCalled();
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
