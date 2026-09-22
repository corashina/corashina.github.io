import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { optimizePortfolioMedia } from "./optimize-portfolio-media.mjs";

const temporaryDirectories: string[] = [];

async function portfolioDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-media-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

it("writes temporary outputs before replacing the video and creating its poster", async () => {
  const directory = await portfolioDirectory();
  const videoPath = join(directory, "demo.mp4");
  const posterPath = join(directory, "demo.webp");
  const calls: Array<{ executable: string; arguments_: string[] }> = [];
  await writeFile(videoPath, "original video");

  await optimizePortfolioMedia({
    directory,
    ffmpegPath: "test-ffmpeg",
    run: async (executable, arguments_) => {
      calls.push({ executable, arguments_ });
      await writeFile(arguments_.at(-1)!, `generated ${calls.length}`);
    },
  });

  expect(calls).toHaveLength(2);
  expect(calls.every(({ executable }) => executable === "test-ffmpeg")).toBe(true);
  expect(calls[0].arguments_.at(-1)).not.toBe(videoPath);
  expect(dirname(calls[0].arguments_.at(-1)!)).toBe(directory);
  expect(await readFile(videoPath, "utf8")).toBe("generated 1");
  expect(await readFile(posterPath, "utf8")).toBe("generated 2");
});

it("leaves the original video unchanged when the runner fails", async () => {
  const directory = await portfolioDirectory();
  const videoPath = join(directory, "demo.mp4");
  await writeFile(videoPath, "original video");

  await expect(
    optimizePortfolioMedia({
      directory,
      run: async () => {
        throw new Error("ffmpeg failed");
      },
    }),
  ).rejects.toThrow("ffmpeg failed");

  expect(await readFile(videoPath, "utf8")).toBe("original video");
});

it("rejects an empty output and leaves the original video unchanged", async () => {
  const directory = await portfolioDirectory();
  const videoPath = join(directory, "demo.mp4");
  await writeFile(videoPath, "original video");

  await expect(
    optimizePortfolioMedia({
      directory,
      run: async (_executable, arguments_) => {
        await writeFile(arguments_.at(-1)!, "");
      },
    }),
  ).rejects.toThrow(/empty/i);

  expect(await readFile(videoPath, "utf8")).toBe("original video");
});
