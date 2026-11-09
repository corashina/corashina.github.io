import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { getProjectBySlug } from "../data/projects";
import { featuredProjects, toolkitGroups } from "../data/profile";
import { HomePage } from "./HomePage";

afterEach(cleanup);

const renderHome = () =>
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );

describe("HomePage", () => {
  it("puts the CV first among the hero actions", () => {
    renderHome();
    const actions = within(screen.getByRole("list", { name: "Get in touch" })).getAllByRole("link");
    expect(actions.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Download CV (PDF)", "/tomasz_zielinski.pdf"],
      ["Email", "mailto:corashina@gmail.com"],
      ["LinkedIn", "https://www.linkedin.com/in/tomasz-zielinski-a97999161/"],
      ["GitHub", "https://github.com/corashina"],
    ]);
  });

  it("lists experience with roles, employers and dates", () => {
    renderHome();
    const section = screen.getByRole("region", { name: "Experience" });
    expect(within(section).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Full-Stack Developer · Xelto2024–2026",
      "Frontend Developer · Xelto2020–2024",
      "BSc Computer Science · University of Southampton2017–2020",
    ]);
  });

  it("links selected work to existing project pages", () => {
    renderHome();
    for (const project of featuredProjects) {
      expect(getProjectBySlug(project.slug)).toBeDefined();
      expect(screen.getByRole("link", { name: `${project.title} →` })).toHaveAttribute(
        "href",
        `/works/${project.slug}`,
      );
    }
    expect(screen.getByRole("link", { name: "All work →" })).toHaveAttribute("href", "/works");
  });

  it("keeps the toolkit in the CV's groups", () => {
    expect(toolkitGroups.map((group) => group.title)).toEqual([
      "Frontend",
      "Backend",
      "Integrations",
      "Testing",
      "Delivery",
    ]);
  });

  it("matches the technology groups in the CV content", () => {
    const cv = readFileSync("scripts/full_stack_cv_content.py", "utf8");
    for (const group of toolkitGroups) {
      const row = new RegExp(`"${group.title}",\\s*\\(([^)]*)\\)`).exec(cv);
      expect(row, group.title).not.toBeNull();
      const cvTechnologies = [...row![1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      expect(group.technologies).toEqual(cvTechnologies);
    }
  });
});
