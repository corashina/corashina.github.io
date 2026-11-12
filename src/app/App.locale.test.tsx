import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

vi.mock("../components/BackgroundCanvas", () => ({ BackgroundCanvas: () => null }));

afterEach(cleanup);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );

describe("Polish routes", () => {
  it.each([
    ["/pl", "Tomasz Zielinski"],
    ["/pl/works", "Projekty"],
    ["/pl/contact", "Kontakt"],
    ["/pl/missing", "404"],
    ["/pl/works/missing-project", "404"],
  ])("renders %s in Polish", async (path, heading) => {
    renderAt(path);
    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pl");
  });

  it("shows the Polish 404 text under /pl", async () => {
    renderAt("/pl/missing");
    expect(await screen.findByText("Przepraszam, ta strona nie istnieje.")).toBeInTheDocument();
  });

  it("keeps navigation links under /pl", async () => {
    renderAt("/pl/works");
    await screen.findByRole("heading", { level: 1, name: "Projekty" });
    const navigation = screen.getByRole("navigation", { name: "Główna nawigacja" });
    const menu = within(navigation).getAllByRole("listitem").map((item) => within(item).getByRole("link"));
    expect(menu.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Start", "/pl"],
      ["Projekty", "/pl/works"],
      ["Artykuły", "/pl/blog"],
      ["Kontakt", "/pl/contact"],
    ]);
  });

  it("translates project text and links project cards under /pl", async () => {
    renderAt("/pl/works");
    await screen.findByRole("heading", { level: 1, name: "Projekty" });
    expect(screen.getByRole("link", { name: "Xelcode" })).toHaveAttribute("href", "/pl/works/xelcode");
    expect(screen.getByRole("heading", { name: "komercyjne" })).toBeInTheDocument();
  });

  it("renders a Polish project page", async () => {
    renderAt("/pl/works/xelcode");
    expect(
      await screen.findByText(
        "Procesy magazynowe i produkcyjne obsługiwane skanerami, zintegrowane z Oracle JD Edwards E1.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Opis produktu →" })).toBeInTheDocument();
    expect(document.title).toBe("Xelcode | Tomasz Zielinski");
  });

  it("sets the Polish page title and description", async () => {
    renderAt("/pl/contact");
    await screen.findByRole("heading", { level: 1, name: "Kontakt" });
    expect(document.title).toBe("Kontakt | Tomasz Zielinski");
    expect(screen.getByRole("button", { name: "Włącz jasny motyw" })).toBeInTheDocument();
  });
});

describe("language switch", () => {
  it("links to the same page in the other language and back", async () => {
    const user = userEvent.setup();
    renderAt("/works/xelcode");
    await screen.findByRole("heading", { name: "Xelcode" });
    expect(document.documentElement.lang).toBe("en");

    const toPolish = screen.getByRole("link", { name: "Polska wersja" });
    expect(toPolish).toHaveAttribute("href", "/pl/works/xelcode");
    expect(toPolish).toHaveAttribute("hreflang", "pl");
    expect(toPolish).toHaveTextContent("PL");

    await user.click(toPolish);
    expect(await screen.findByText(/Procesy magazynowe/)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pl");
    expect(screen.getByRole("link", { name: "English version" })).toHaveAttribute("href", "/works/xelcode");
  });

  it("switches the home page to /pl and back to /", async () => {
    renderAt("/pl");
    await screen.findByRole("heading", { level: 1, name: "Tomasz Zielinski" });
    expect(screen.getByRole("heading", { name: "programista full-stack" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "English version" })).toHaveAttribute("href", "/");
  });
});

describe("language switch transition", () => {
  it("keeps the outgoing page in its own language while it slides out", async () => {
    const user = userEvent.setup();
    const { container } = renderAt("/contact");
    await screen.findByRole("heading", { level: 1, name: "Contact" });

    await user.click(screen.getByRole("link", { name: "Polska wersja" }));
    await screen.findByRole("heading", { level: 1, name: "Kontakt" });

    const headings = [...container.querySelectorAll("main h1")].map((heading) => heading.textContent);
    expect(headings).toContain("Kontakt");
    expect(headings.filter((text) => text === "Kontakt")).toHaveLength(1);
  });
});
