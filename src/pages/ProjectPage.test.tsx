import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
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

});
