import { expect, it, vi } from "vitest";
import { revealArticleFragment } from "./articleFragments";
it("opens nested sources and scrolls only the active article", () => {
  const root=document.createElement("article");
  root.innerHTML='<details><summary>Outer</summary><details id="source-01"><summary>Inner</summary><pre id="code">source</pre></details></details>';
  const target=root.querySelector<HTMLElement>("#code")!;
  target.scrollIntoView=vi.fn();
  expect(revealArticleFragment(root,"#code")).toBe(true);
  expect([...root.querySelectorAll("details")].every(el=>el.open)).toBe(true);
  expect(target.scrollIntoView).toHaveBeenCalled();
  expect(revealArticleFragment(root,"#%ZZ")).toBe(false);
  expect(revealArticleFragment(root,"#missing")).toBe(false);
  root.querySelectorAll("details").forEach(el=>{el.open=false;});
  expect(revealArticleFragment(root,"#source-01")).toBe(true);
  expect([...root.querySelectorAll("details")].every(el=>el.open)).toBe(true);
});
