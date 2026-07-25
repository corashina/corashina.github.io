import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectPage } from "./ProjectPage";

const renderProject = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/works/${slug}`]}>
      <Routes>
        <Route path="/works/:slug" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProjectPage", () => {
  it("renders the original project fields", () => {
    renderProject("webgl-minecraft");

    expect(
      screen.getByRole("heading", { level: 2, name: "WebGL-Minecraft" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "2018" })).toBeInTheDocument();
    expect(screen.getByText("Primitive minecraft clone made with three.js")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "javascript",
      "three.js",
      "webgl",
    ]);
    expect(screen.getByRole("link", { name: "github →" })).toHaveAttribute(
      "href",
      "https://github.com/corashina/WebGL-Minecraft",
    );
  });

  it("renders a company product overview instead of a GitHub link", () => {
    renderProject("xelcode");

    expect(screen.getByRole("heading", { level: 2, name: "Xelcode" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Product overview →" })).toHaveAttribute(
      "href",
      "https://xelcode.com/product/",
    );
  });

  it("renders the project start timestamp semantically", () => {
    renderProject("xelcode");

    expect(screen.getByText("2021")).toHaveAttribute(
      "dateTime",
      "2021",
    );
    expect(screen.queryByText(/Started:/)).not.toBeInTheDocument();
  });

  it("plays detail video media on hover, then pauses and resets it", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: false }),
    );
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    renderProject("endless-city");

    const video = screen.getByLabelText("Infinite procedural WebGL city scene");
    expect(video).toHaveAttribute("src", "/portfolio/endless-city.mp4");
    const media = video.parentElement;
    expect(media).not.toBeNull();
    Object.defineProperty(video, "currentTime", { configurable: true, value: 12, writable: true });

    fireEvent.mouseEnter(media!);
    await Promise.resolve();
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(media!);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(video).toHaveProperty("currentTime", 0);
  });

  it("keeps detail video interactive when reduced motion is requested", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    renderProject("endless-city");

    const video = screen.getByLabelText("Infinite procedural WebGL city scene");
    expect(video).toHaveAttribute("src", "/portfolio/endless-city.mp4");
    expect(video).not.toHaveAttribute("controls");
    fireEvent.mouseEnter(video.parentElement!);
    await Promise.resolve();

    expect(play).toHaveBeenCalledOnce();
  });

  it("renders the not-found page for an unknown project slug", () => {
    renderProject("missing-project");

    expect(screen.getByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
  });
});
