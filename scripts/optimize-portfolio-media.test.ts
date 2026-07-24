import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  optimizePortfolioMedia,
  posterArguments,
  videoArguments,
} from "./optimize-portfolio-media.mjs";

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

it("builds the requested H.264 video arguments", () => {
  const arguments_ = videoArguments("input.mp4", "output.mp4");

  expect(arguments_).toEqual([
    "-y",
    "-i",
    "input.mp4",
    "-vf",
    "scale='min(960,iw)':-2:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
    "-c:v",
    "libx264",
    "-crf",
    "28",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    "output.mp4",
  ]);
});

it("builds the requested WebP poster arguments", () => {
  const arguments_ = posterArguments("input.mp4", "output.webp");

  expect(arguments_).toEqual([
    "-y",
    "-ss",
    "0.5",
    "-i",
    "input.mp4",
    "-frames:v",
    "1",
    "-vf",
    "scale='min(960,iw)':-2:force_original_aspect_ratio=decrease",
    "-c:v",
    "libwebp",
    "-quality",
    "76",
    "output.webp",
  ]);
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
