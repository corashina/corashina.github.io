import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** @param {string} outputDirectory */
export async function createSpaFallback(outputDirectory) {
  await copyFile(join(outputDirectory, "index.html"), join(outputDirectory, "404.html"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await createSpaFallback(fileURLToPath(new URL("../dist", import.meta.url)));
}
