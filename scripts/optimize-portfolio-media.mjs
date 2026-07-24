import { spawn } from "node:child_process";
import {
  readdir,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const videoArguments = (input, output) => [
  "-y", "-i", input,
  "-vf", "scale='min(960,iw)':-2:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
  "-c:v", "libx264", "-crf", "28", "-preset", "slow",
  "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
  output,
];

export const posterArguments = (input, output) => [
  "-y", "-ss", "0.5", "-i", input, "-frames:v", "1",
  "-vf", "scale='min(960,iw)':-2:force_original_aspect_ratio=decrease",
  "-c:v", "libwebp", "-quality", "76", output,
];

const runFfmpeg = (executable, arguments_) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(executable, arguments_, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal
            ? `${executable} was terminated by ${signal}`
            : `${executable} exited with code ${code}`,
        ),
      );
    });
  });

const assertNonEmpty = async (path) => {
  const output = await stat(path);
  if (output.size === 0) {
    throw new Error(`FFmpeg produced an empty output: ${path}`);
  }
  return output.size;
};

const temporaryPath = (path) => {
  const extension = extname(path);
  const stem = basename(path, extension);
  return join(dirname(path), `.${stem}.${randomUUID()}.tmp${extension}`);
};

const backupPath = (path) =>
  join(dirname(path), `.${basename(path)}.${randomUUID()}.backup`);

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

const replaceSafely = async (temporary, destination) => {
  if (!(await exists(destination))) {
    await rename(temporary, destination);
    return;
  }

  const backup = backupPath(destination);
  await rename(destination, backup);
  try {
    await rename(temporary, destination);
  } catch (replacementError) {
    try {
      await rename(backup, destination);
    } catch (restorationError) {
      throw new AggregateError(
        [replacementError, restorationError],
        `Could not replace or restore ${destination}`,
      );
    }
    throw replacementError;
  }
  await rm(backup, { force: true });
};

const totalBytes = async (directory, extension) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const matching = entries.filter(
    (entry) =>
      entry.isFile() && extname(entry.name).toLowerCase() === extension,
  );
  const sizes = await Promise.all(
    matching.map((entry) => stat(join(directory, entry.name))),
  );
  return sizes.reduce((total, file) => total + file.size, 0);
};

export async function optimizePortfolioMedia(options = {}) {
  const directory = resolve(
    options.directory ?? join(process.cwd(), "static", "portfolio"),
  );
  const ffmpegPath = options.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const run = options.run ?? runFfmpeg;
  const entries = await readdir(directory, { withFileTypes: true });
  const videos = entries
    .filter(
      (entry) =>
        entry.isFile() && extname(entry.name).toLowerCase() === ".mp4",
    )
    .map((entry) => entry.name)
    .sort();

  for (const name of videos) {
    const inputPath = join(directory, name);
    const posterPath = join(directory, `${basename(name, extname(name))}.webp`);
    const temporaryVideo = temporaryPath(inputPath);
    const temporaryPoster = temporaryPath(posterPath);
    const beforeBytes = (await stat(inputPath)).size;

    try {
      await run(ffmpegPath, videoArguments(inputPath, temporaryVideo));
      const afterBytes = await assertNonEmpty(temporaryVideo);
      await run(ffmpegPath, posterArguments(inputPath, temporaryPoster));
      await assertNonEmpty(temporaryPoster);

      await replaceSafely(temporaryVideo, inputPath);
      await replaceSafely(temporaryPoster, posterPath);
      console.log(`${name}: ${beforeBytes} -> ${afterBytes} bytes`);
    } finally {
      await Promise.all([
        rm(temporaryVideo, { force: true }),
        rm(temporaryPoster, { force: true }),
      ]);
    }
  }

  const mp4Bytes = await totalBytes(directory, ".mp4");
  const webpBytes = await totalBytes(directory, ".webp");
  console.log(`MP4 total: ${mp4Bytes} bytes`);
  console.log(`WebP total: ${webpBytes} bytes`);

  return { videos: videos.length, mp4Bytes, webpBytes };
}

const invokedPath = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  await optimizePortfolioMedia();
}
