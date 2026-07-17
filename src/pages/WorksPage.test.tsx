import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { projects } from "../data/projects";
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
  it("renders exactly the twelve approved projects as single semantic links", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "selected projects" }),
    ).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(12);

    for (const project of projects) {
      const link = screen.getByRole("link", {
        name: `${project.title}: ${project.summary}`,
      });
      expect(link).toHaveAttribute("href", `/works/${project.slug}`);
      expect(within(link).getByRole("heading", { name: project.title })).toBeInTheDocument();
      expect(within(link).queryByRole("link")).not.toBeInTheDocument();
    }

    expect(links[0]).toHaveAttribute("href", "/works/warehouse-manufacturing-workflows");
  });

  it("plays video previews from card hover and keyboard focus, then pauses and resets them", async () => {
    setReducedMotion(false);
    const play = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockRejectedValue(new Error("autoplay blocked"));
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    renderPage();

    const card = screen.getByRole("link", {
      name: "Endless City: An infinite procedural WebGL city.",
    });
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

    const card = screen.getByRole("link", {
      name: "Endless City: An infinite procedural WebGL city.",
    });
    fireEvent.mouseEnter(card);
    fireEvent.focus(card);

    expect(play).not.toHaveBeenCalled();
  });

  it("shows the approved alt text when project media fails", () => {
    renderPage();

    const card = screen.getByRole("link", {
      name: "Document AI: PDF intake, prompts, analysis, and JSON or text results.",
    });
    const image = within(card).getByRole("img", { name: "Document AI review interface" });

    fireEvent.error(image);

    expect(within(card).getByText("Document AI review interface")).toBeInTheDocument();
    expect(within(card).queryByRole("img")).not.toBeInTheDocument();
  });
});
