import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectMedia as ProjectMediaData } from "../data/projects";
import styles from "../styles/work.module.scss";
import { ProjectMedia } from "./ProjectMedia";

const videoMedia = {
  kind: "video",
  src: "/portfolio/demo.mp4",
  posterSrc: "/portfolio/demo.webp",
  alt: "Demo interface",
} satisfies ProjectMediaData;

const secondVideoMedia = {
  kind: "video",
  src: "/portfolio/second.mp4",
  posterSrc: "/portfolio/second.webp",
  alt: "Second interface",
} satisfies ProjectMediaData;

const imageMedia = {
  kind: "image",
  src: "/portfolio/demo.png",
  alt: "Demo image",
} satisfies ProjectMediaData;

let observerCallback: IntersectionObserverCallback;
let observer: IntersectionObserverStub;

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
  readonly disconnect = vi.fn();
  readonly takeRecords = vi.fn(() => []);

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    this.rootMargin = options?.rootMargin ?? "0px";
    observer = this;
  }
}

const setReducedMotion = (matches: boolean) => {
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches }));
};

const renderInteractive = (loadingMode: "viewport" | "eager" = "viewport") =>
  render(
    <a href="/works/demo">
      <ProjectMedia interactive loadingMode={loadingMode} media={videoMedia} />
    </a>,
  );

beforeEach(() => {
  setReducedMotion(false);
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ProjectMedia", () => {
  it("defers viewport video until intersection and keeps its poster until loadeddata", () => {
    render(<ProjectMedia interactive loadingMode="viewport" media={videoMedia} />);

    const video = screen.getByLabelText("Demo interface") as HTMLVideoElement;
    const poster = screen.getByRole("img", { name: "Demo interface" });
    expect(video).not.toHaveAttribute("src");
    expect(video).toHaveAttribute("preload", "none");
    expect(poster).toHaveAttribute("src", "/portfolio/demo.webp");
    expect(poster).toHaveAttribute("loading", "lazy");
    expect(poster).toHaveAttribute("decoding", "async");
    expect(poster).not.toHaveClass(styles.mediaPosterHidden);
    expect(observer.rootMargin).toBe("200px");
    expect(observer.observe).toHaveBeenCalledWith(video.parentElement);

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer,
      );
    });

    expect(video).toHaveAttribute("src", "/portfolio/demo.mp4");
    expect(video).toHaveAttribute("preload", "metadata");
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(poster).not.toHaveClass(styles.mediaPosterHidden);

    fireEvent.loadedData(video);

    expect(video).toHaveClass(styles.mediaVideoLoaded);
    expect(poster).toHaveClass(styles.mediaPosterHidden);
  });

  it("plays a named standalone eager video surface on keyboard focus, then resets on blur", async () => {
    const user = userEvent.setup();
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    render(
      <>
        <ProjectMedia interactive loadingMode="eager" media={videoMedia} />
        <button type="button">Next</button>
      </>,
    );

    const surface = screen.getByRole("group", {
      name: "Demo interface video preview",
    });
    const video = screen.getByLabelText("Demo interface") as HTMLVideoElement;
    expect(video.parentElement).toBe(surface);
    Object.defineProperty(video, "currentTime", {
      configurable: true,
      value: 12,
      writable: true,
    });

    expect(surface).toHaveAccessibleName("Demo interface video preview");
    expect(surface).toHaveAttribute("tabindex", "0");

    await user.tab();
    expect(surface).toHaveFocus();
    expect(play).toHaveBeenCalledOnce();

    video.currentTime = 8;
    await user.tab();
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
    expect(pause).toHaveBeenCalledOnce();
    expect(video).toHaveProperty("currentTime", 0);
  });

  it("restores the poster after video failure and blocks later play calls", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    renderInteractive("eager");
    const video = screen.getByLabelText("Demo interface") as HTMLVideoElement;
    const poster = screen.getByRole("img", { name: "Demo interface" });
    const target = video.closest("a")!;

    fireEvent.loadedData(video);
    expect(poster).toHaveClass(styles.mediaPosterHidden);

    fireEvent.error(video);
    expect(poster).not.toHaveClass(styles.mediaPosterHidden);
    expect(video).not.toHaveClass(styles.mediaVideoLoaded);

    fireEvent.mouseEnter(target);
    fireEvent.focus(target);
    expect(play).not.toHaveBeenCalled();
  });

  it("does not leak activation, loaded, or failure state between media records", () => {
    const { rerender } = render(
      <ProjectMedia interactive loadingMode="viewport" media={videoMedia} />,
    );
    const firstVideo = screen.getByLabelText("Demo interface");
    const firstPoster = screen.getByRole("img", { name: "Demo interface" });

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer,
      );
    });
    fireEvent.loadedData(firstVideo);
    expect(firstPoster).toHaveClass(styles.mediaPosterHidden);
    fireEvent.error(firstPoster);
    fireEvent.error(firstVideo);
    expect(screen.getByText("Demo interface")).toBeInTheDocument();

    rerender(
      <ProjectMedia interactive loadingMode="viewport" media={secondVideoMedia} />,
    );

    const secondVideo = screen.getByLabelText("Second interface");
    const secondPoster = screen.getByRole("img", { name: "Second interface" });
    expect(secondVideo).not.toHaveAttribute("src");
    expect(secondPoster).not.toHaveClass(styles.mediaPosterHidden);
    expect(screen.queryByText("Second interface")).not.toBeInTheDocument();

    act(() => {
      observerCallback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        observer,
      );
    });
    expect(secondVideo).toHaveAttribute("src", "/portfolio/second.mp4");
    fireEvent.loadedData(secondVideo);
    expect(secondPoster).toHaveClass(styles.mediaPosterHidden);
  });

  it("uses loading mode for image media and falls back to its alt text", () => {
    const { rerender } = render(
      <ProjectMedia interactive loadingMode="viewport" media={imageMedia} />,
    );
    expect(screen.getByRole("img", { name: "Demo image" })).toHaveAttribute("loading", "lazy");
    expect(screen.getByRole("img", { name: "Demo image" })).toHaveAttribute("decoding", "async");

    rerender(<ProjectMedia interactive loadingMode="eager" media={imageMedia} />);
    const image = screen.getByRole("img", { name: "Demo image" });
    expect(image).toHaveAttribute("loading", "eager");
    fireEvent.error(image);
    expect(screen.getByText("Demo image")).toBeInTheDocument();
  });
});
