import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { projects } from "../data/projects";
import { ProjectPage } from "./ProjectPage";

const renderProject = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/works/${slug}`]}>
      <Routes>
        <Route path="/works/:slug" element={<ProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(cleanup);

describe("ProjectPage", () => {
  it("keeps private Document AI work free of source links", () => {
    renderProject("document-ai");

    expect(screen.getByRole("heading", { level: 1, name: "Document AI" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links Endless City to its approved public repository", () => {
    renderProject("endless-city");

    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/corashina/Endless-City",
    );
  });

  it("renders source links only for the three approved public projects", () => {
    const approvedSources = new Map([
      ["endless-city", "https://github.com/corashina/Endless-City"],
      ["particle-simulation", "https://github.com/corashina/Particle-Simulation"],
      ["civio", "https://github.com/corashina/Civio"],
    ]);

    for (const project of projects) {
      const { unmount } = renderProject(project.slug);
      const sourceLink = screen.queryByRole("link");
      const expectedSource = approvedSources.get(project.slug);

      if (expectedSource) {
        expect(sourceLink).toHaveAttribute("href", expectedSource);
      } else {
        expect(sourceLink).not.toBeInTheDocument();
      }

      unmount();
    }
  });

  it("renders approved overview, contribution, technology, and media content", () => {
    const project = projects[0];
    renderProject(project.slug);

    expect(screen.getByText(project.overview)).toBeInTheDocument();
    const contributions = screen.getByRole("region", { name: "Selected contribution" });
    expect(within(contributions).getAllByRole("listitem")).toHaveLength(
      project.contributions.length,
    );
    const technologies = screen.getByRole("region", { name: "Technologies" });
    expect(within(technologies).getAllByRole("listitem")).toHaveLength(
      project.technologies.length,
    );
    expect(screen.getByRole("img", { name: project.media.alt })).toHaveAttribute(
      "src",
      project.media.src,
    );
  });

  it("renders the not-found page for an unknown project slug", () => {
    renderProject("missing-project");

    expect(screen.getByRole("heading", { level: 1, name: "404" })).toBeInTheDocument();
  });
});
