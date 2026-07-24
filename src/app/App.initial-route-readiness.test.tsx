import { act, cleanup, render, screen } from "@testing-library/react";
import type { JSX } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

const homeModule = vi.hoisted(() => {
  let resolveModule: (
    value: { HomePage(): JSX.Element },
  ) => void = () => {};
  const promise = new Promise<{ HomePage(): JSX.Element }>((resolve) => {
    resolveModule = resolve;
  });

  return {
    promise,
    resolve: resolveModule,
  };
});

const sceneMocks = vi.hoisted(() => ({
  createBackgroundScene: vi.fn(),
}));

vi.mock("../pages/HomePage", () => homeModule.promise);

vi.mock("../three/backgroundScene", () => ({
  createBackgroundScene: sceneMocks.createBackgroundScene,
  normalizePointer: vi.fn(),
  normalizePointerSpeed: vi.fn(),
}));

beforeEach(() => {
  sceneMocks.createBackgroundScene.mockReset();
  localStorage.clear();
  document.body.className = "";
  document.body.style.colorScheme = "";
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
  vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContextStub {});
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn(() => 41),
  );
  vi.stubGlobal("cancelIdleCallback", vi.fn());
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("waits for the initial lazy route commit before scheduling the background scene", async () => {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
  await act(async () => {});

  expect(screen.queryByRole("heading", { name: "Committed route" })).not.toBeInTheDocument();
  expect(requestIdleCallback).not.toHaveBeenCalled();
  expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();

  await act(async () => {
    homeModule.resolve({
      HomePage: () => <h1>Committed route</h1>,
    });
    await homeModule.promise;
  });

  expect(await screen.findByRole("heading", { name: "Committed route" })).toBeInTheDocument();
  expect(requestIdleCallback).toHaveBeenCalledOnce();
  expect(sceneMocks.createBackgroundScene).not.toHaveBeenCalled();
});
