import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

afterEach(cleanup);

describe("App routes", () => {
  it.each([
    ["/", "Tomasz Zielinski"],
    ["/works", "Work"],
    ["/contact", "Contact"],
    ["/missing", "404"]
  ])("renders %s", async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("uses one main landmark for a missing project route", async () => {
    render(<MemoryRouter initialEntries={["/works/missing-project"]}><App /></MemoryRouter>);

    expect(await screen.findByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });
});
