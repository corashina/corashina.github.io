import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { findPost } from "../blog/catalog";
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

afterEach(() => {
  cleanup();
});

describe("ProjectPage", () => {
  it("renders the original project fields and its write-up", () => {
    renderProject("webgl-minecraft");

    expect(
      screen.getByRole("heading", { level: 1, name: "WebGL-Minecraft" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2018")).toHaveAttribute("dateTime", "2018-04");
    expect(screen.getByText("Primitive minecraft clone made with three.js")).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Stack" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["JavaScript", "Three.js", "WebGL"]);
    expect(
      screen.getByRole("link", { name: "Building an editable voxel world in the browser →" }),
    ).toHaveAttribute("href", "/blog/building-an-editable-voxel-world-in-the-browser");
    expect(screen.getByRole("link", { name: "github →" })).toHaveAttribute(
      "href",
      "https://github.com/corashina/webGL-Minecraft",
    );
    expect(screen.queryByRole("heading", { name: "What I built" })).not.toBeInTheDocument();
  });

  it("renders a commercial project as a short case study with a hiring call to action", () => {
    renderProject("xelcode");

    expect(screen.getByRole("heading", { level: 1, name: "Xelcode" })).toBeInTheDocument();
    expect(screen.getByText(/^Xelto ·/)).toHaveTextContent("Xelto · 2020–2026");
    expect(screen.getByRole("heading", { name: "What I built" })).toBeInTheDocument();
    expect(screen.getByText(/deployed at 12 client companies/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Product overview →" })).toHaveAttribute(
      "href",
      "https://xelcode.com/product/",
    );
    expect(screen.getByRole("link", { name: "Email me" })).toHaveAttribute(
      "href",
      "mailto:corashina@gmail.com",
    );
    expect(screen.getByRole("link", { name: "download my CV" })).toHaveAttribute(
      "href",
      "/tomasz_zielinski.pdf",
    );
  });

  it("links every write-up to a published post", () => {
    for (const project of projects) {
      for (const slug of project.writeUps) {
        expect(findPost(slug), `${project.slug} -> ${slug}`).toBeDefined();
      }
    }
  });
});
