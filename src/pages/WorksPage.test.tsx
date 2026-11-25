import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { WorksPage } from "./WorksPage";

const renderPage = () =>
  render(
    <MemoryRouter>
      <WorksPage />
    </MemoryRouter>,
  );

afterEach(() => {
  cleanup();
});

describe("WorksPage", () => {
  it("renders all projects as single semantic links in order", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "commercial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "freelance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "experiments" })).toBeInTheDocument();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(14);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/works/icr",
      "/works/workflow",
      "/works/holiday",
      "/works/einvoicing",
      "/works/xelapps",
      "/works/xelcode",
      "/works/fitmed",
      "/works/the-long-drive",
      "/works/dont-sleep-with-the-fishes",
      "/works/cosmic-sugar",
      "/works/mibsi-cluster-bridge",
      "/works/flappy-pixie",
      "/works/endless-city",
      "/works/webgl-minecraft",
    ]);

    for (const link of links) {
      expect(within(link).queryByRole("link")).not.toBeInTheDocument();
      expect(within(link).getByText(link.getAttribute("aria-label") ?? "")).toBeInTheDocument();
    }
    const xelcode = screen.getByRole("link", { name: "Xelcode" });
    expect(within(xelcode).getByText("2020–2026")).toHaveAttribute("dateTime", "2020");
    expect(within(xelcode).queryByText(/Started:/)).not.toBeInTheDocument();
  });

});
