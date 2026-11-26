import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MorphHero } from "./MorphHero";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MorphHero", () => {
  it("renders a decorative canvas and stays quiet when 2D canvas is unavailable", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const requestFrame = vi.spyOn(window, "requestAnimationFrame");

    render(<MorphHero />);

    expect(screen.getByTestId("morph-hero").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it("animates while mounted and stops on unmount", () => {
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      fillStyle: "",
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(7);
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { unmount } = render(<MorphHero />);
    expect(requestFrame).toHaveBeenCalledOnce();

    const draw = requestFrame.mock.calls[0][0];
    draw(1_000);
    expect(context.fillRect).toHaveBeenCalledTimes(2_400);

    unmount();
    expect(cancelFrame).toHaveBeenCalledWith(7);
  });
});
