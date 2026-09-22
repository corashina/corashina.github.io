import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PostBody, PostMeta } from "../blog/types";
const mocks=vi.hoisted(()=>({posts:[] as PostMeta[], load:vi.fn()}));
vi.mock("../blog/catalog",()=>({posts:mocks.posts,findPost:(slug:string)=>mocks.posts.find(p=>p.slug===slug),loadPostBody:mocks.load}));
vi.mock("../components/BackgroundCanvas",()=>({BackgroundCanvas:()=>null}));
import { BlogPage } from "./BlogPage";
import { BlogPostPage } from "./BlogPostPage";
import { App } from "../app/App";
const body:PostBody={html:'<h2 id="chapter">Chapter</h2><p>Article body</p><details id="source-01"><summary>Read source</summary><pre>exact source</pre></details><p><a href="#source-01">Source link</a></p>',headings:[{id:"chapter",text:"Chapter",level:2}]};
beforeEach(()=>{
  vi.spyOn(window,"scrollTo").mockImplementation(()=>{});
  mocks.posts.splice(0,mocks.posts.length,{slug:"example",title:'Quotes " and <tags>',description:"Summary & details",date:"2026-09-22",tags:["QNX"]});
  mocks.load.mockReset().mockResolvedValue(body);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it("lists metadata without fetching article bodies and handles an empty blog",()=>{
  const view=render(<MemoryRouter><BlogPage/></MemoryRouter>);
  expect(screen.getByRole("link",{name:'Quotes " and <tags>'})).toHaveAttribute("href","/blog/example");
  expect(screen.getByText("QNX")).toBeInTheDocument();
  expect(mocks.load).not.toHaveBeenCalled();
  view.unmount();mocks.posts.splice(0);
  render(<MemoryRouter><BlogPage/></MemoryRouter>);
  expect(screen.getByText(/no articles/i)).toBeInTheDocument();
});
function article(path="/blog/example") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/blog/:slug" element={<BlogPostPage/>}/></Routes></MemoryRouter>);
}
it("loads a direct fragment, opens the source, and allows repeated fragment clicks",async()=>{
  const user=userEvent.setup();article("/blog/example#source-01");
  expect(await screen.findByText("Article body")).toBeInTheDocument();
  const disclosure=screen.getByText("Read source").closest("details")!;
  await waitFor(()=>expect(disclosure.open).toBe(true));
  disclosure.open=false;
  await user.click(screen.getByRole("link",{name:"Source link"}));
  await waitFor(()=>expect(disclosure.open).toBe(true));
  expect(document.title).toBe('Quotes " and <tags> | Tomasz Zielinski');
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Summary & details");
});
it("shows a retry after a failed body load",async()=>{
  mocks.load.mockRejectedValueOnce(new Error("offline"));
  article();
  expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load/i);
  await userEvent.click(screen.getByRole("button",{name:"Retry"}));
  expect(await screen.findByText("Article body")).toBeInTheDocument();
});
it("shows unknown or draft slugs as not found without a fetch",async()=>{
  article("/blog/draft");
  expect(screen.getByRole("heading",{name:"404"})).toBeInTheDocument();
  expect(mocks.load).not.toHaveBeenCalled();
});
it("returns from the active Blog menu to the index and restores non-blog metadata",async()=>{
  render(<MemoryRouter initialEntries={["/blog/example"]}><App/></MemoryRouter>);
  expect(await screen.findByText("Article body")).toBeInTheDocument();
  const nav=screen.getByRole("navigation",{name:"Primary navigation"});
  expect(within(nav).getByRole("link",{name:"Blog"})).toHaveAttribute("aria-current","page");
  await userEvent.click(within(nav).getByRole("link",{name:"Blog"}));
  expect(await screen.findByRole("region",{name:"Blog posts"})).toBeInTheDocument();
  expect(screen.getAllByRole("main")).toHaveLength(1);
  await userEvent.click(within(nav).getByRole("link",{name:"Contact"}));
  await screen.findByRole("heading",{name:"Contact",level:1});
  await waitFor(()=>expect(document.title).toBe("Contact"));
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe("Tomasz Zielinski, full-stack software engineer.");
});
it("ignores an obsolete request when navigating between articles",async()=>{
  mocks.posts.push({...mocks.posts[0],slug:"second",title:"Second"});
  let complete!:(body:PostBody)=>void;
  mocks.load.mockImplementationOnce(()=>new Promise<PostBody>(resolve=>{complete=resolve;})).mockResolvedValueOnce({...body,html:"<p>Second body</p>"});
  let navigate!:NavigateFunction;
  function Control(){navigate=useNavigate();return null;}
  render(<MemoryRouter initialEntries={["/blog/example"]}><Control/><Routes><Route path="/blog/:slug" element={<BlogPostPage/>}/></Routes></MemoryRouter>);
  expect(screen.getByRole("status")).toBeInTheDocument();
  await act(async()=>navigate("/blog/second"));
  expect(await screen.findByText("Second body")).toBeInTheDocument();
  await act(async()=>complete(body));
  expect(screen.queryByText("Article body")).not.toBeInTheDocument();
});

it("encodes explicit heading IDs in generated contents links",async()=>{
 mocks.load.mockResolvedValue({html:'<h2 id="100%">Completion</h2>',headings:[{id:"100%",text:"Completion",level:2}]});
 article();
 expect(await screen.findByRole("link",{name:"Completion"})).toHaveAttribute("href","#100%25");
});

it("resets scroll when leaving a blog page, but not for a source fragment",async()=>{
 render(<MemoryRouter initialEntries={["/blog/example"]}><App/></MemoryRouter>);
 await screen.findByText("Article body");
 const scroll=vi.mocked(window.scrollTo);scroll.mockClear();
 await userEvent.click(screen.getByRole("link",{name:"Source link"}));
 expect(scroll).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole("link",{name:"← All articles"}));
 await screen.findByRole("region",{name:"Blog posts"});
 expect(scroll).toHaveBeenCalledWith({top:0,left:0,behavior:"instant"});
});
