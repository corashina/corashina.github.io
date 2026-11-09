import { describe, expect, it, vi } from "vitest";
import { normalizeTrailingSlash } from "./normalizeTrailingSlash";

const run = (url: string) => {
  const parsed = new URL(url, "https://www.tomasz-zielinski.com");
  const history = { state: { idx: 0 }, replaceState: vi.fn() } as unknown as History;
  normalizeTrailingSlash(parsed as unknown as Location, history);
  return history.replaceState as ReturnType<typeof vi.fn>;
};

describe("normalizeTrailingSlash", () => {
  it("removes the trailing slash GitHub Pages adds to route directories", () => {
    expect(run("/works/xelcode/?ref=cv#top")).toHaveBeenCalledWith({ idx: 0 }, "", "/works/xelcode?ref=cv#top");
  });

  it("leaves the root and slash-free paths alone", () => {
    expect(run("/")).not.toHaveBeenCalled();
    expect(run("/contact")).not.toHaveBeenCalled();
  });
});
