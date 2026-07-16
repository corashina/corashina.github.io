import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createSpaFallback } from "./create-spa-fallback.mjs";

it("copies index to 404", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-"));
  try {
    await writeFile(join(directory, "index.html"), "<main>portfolio</main>");
    await createSpaFallback(directory);
    expect(await readFile(join(directory, "404.html"), "utf8")).toBe("<main>portfolio</main>");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
