import { afterEach, expect, it, vi } from "vitest";
vi.mock("virtual:blog", () => ({
  posts: [{slug:"example", title:"Example", description:"Summary", date:"2026-09-22", tags:[]}],
  articleUrls: {example:"/__blog/example.json"},
}));
import { findPost, loadPostBody } from "./catalog";
afterEach(() => vi.unstubAllGlobals());
it("finds metadata without loading a body and refuses unknown slugs", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(findPost("example")?.title).toBe("Example");
  await expect(loadPostBody("missing")).rejects.toThrow(/not found/i);
  expect(fetcher).not.toHaveBeenCalled();
});
it("retries a failed load and forwards cancellation", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ok:false}).mockResolvedValueOnce({ok:true,json:async()=>({html:"<p>Body</p>",headings:[]})});
  vi.stubGlobal("fetch", fetcher);
  await expect(loadPostBody("example")).rejects.toThrow();
  const signal = new AbortController().signal;
  await expect(loadPostBody("example", signal)).resolves.toMatchObject({html:"<p>Body</p>"});
  expect(fetcher).toHaveBeenLastCalledWith("/__blog/example.json", {signal});
});
it.each([{}, {html:42,headings:[]}, {html:"",headings:[{id:"x",text:"Title",level:7}]}])("rejects malformed body %j", async body => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ok:true,json:async()=>body}));
  await expect(loadPostBody("example")).rejects.toThrow(/invalid/i);
});
