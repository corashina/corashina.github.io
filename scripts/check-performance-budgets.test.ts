import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, expect, it } from "vitest";
import {
  checkPerformanceBudgets,
  collectStaticManifestEntries,
} from "./check-performance-budgets.mjs";

const temporaryDirectories: string[] = [];
const javascriptBudget = 120 * 1024;
const mp4Budget = 10 * 1024 * 1024;
const webpBudget = 500 * 1024;

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "performance-budgets-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function writeFixture(
  manifest: Record<string, unknown>,
  files: Record<string, Uint8Array | string> = {},
) {
  const root = await temporaryDirectory();
  const distDirectory = join(root, "dist");
  const staticDirectory = join(root, "static", "portfolio");

  await mkdir(join(distDirectory, ".vite"), { recursive: true });
  await mkdir(staticDirectory, { recursive: true });
  await writeFile(
    join(distDirectory, ".vite", "manifest.json"),
    JSON.stringify(manifest),
  );

  await Promise.all(
    Object.entries(files).map(async ([path, contents]) => {
      const destination = path.startsWith("static/")
        ? join(root, path)
        : join(distDirectory, path);
      await mkdir(join(destination, ".."), { recursive: true });
      await writeFile(destination, contents);
    }),
  );

  return { distDirectory, staticDirectory };
}

function manifest(overrides: Record<string, unknown> = {}) {
  return {
    "index.html": {
      file: "assets/index.js",
      imports: ["_shared.js"],
      dynamicImports: ["src/three/backgroundScene.ts"],
    },
    "_shared.js": { file: "assets/shared.js" },
    "src/three/backgroundScene.ts": {
      file: "assets/background.js",
      isDynamicEntry: true,
    },
    ...overrides,
  };
}

function budgetOptions(directories: {
  distDirectory: string;
  staticDirectory: string;
}) {
  return { ...directories, logger: () => {} };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

it("collects only the initial static manifest closure", () => {
  const entries = manifest();

  expect(collectStaticManifestEntries(entries, "index.html")).toEqual([
    "index.html",
    "_shared.js",
  ]);
});

it("uses gzip byte lengths for the initial JavaScript total", async () => {
  const javascript = randomBytes(2048);
  const directories = await writeFixture(manifest(), {
    "assets/index.js": javascript,
    "assets/shared.js": "shared",
    "assets/background.js": "background",
  });

  const result = await checkPerformanceBudgets(budgetOptions(directories));

  expect(result.initialJavaScriptGzipBytes).toBe(
    gzipSync(javascript).byteLength + gzipSync(Buffer.from("shared")).byteLength,
  );
});

it("reports the measured initial gzip overage and its allowance", async () => {
  const overBudgetJavascript = randomBytes(122_803);
  expect(
    gzipSync(overBudgetJavascript).byteLength + gzipSync(Buffer.alloc(0)).byteLength,
  ).toBe(javascriptBudget + 1);
  const directories = await writeFixture(manifest(), {
    "assets/index.js": overBudgetJavascript,
    "assets/shared.js": "",
    "assets/background.js": "background",
  });

  await expect(checkPerformanceBudgets(budgetOptions(directories))).rejects.toThrow(
    `Initial JavaScript gzip budget exceeded: ${javascriptBudget + 1} bytes (allowed ${javascriptBudget} bytes)`,
  );
});

it("rejects Three.js code in the static manifest closure", async () => {
  const directories = await writeFixture(
    manifest({
      "_shared.js": {
        file: "assets/shared.js",
        imports: ["_particles.js"],
      },
      "_particles.js": {
        file: "assets/particles.js",
        src: "src/three/particleField.ts",
      },
    }),
    {
      "assets/index.js": "index",
      "assets/shared.js": "shared",
      "assets/particles.js": "particles",
      "assets/background.js": "background",
    },
  );

  await expect(checkPerformanceBudgets(budgetOptions(directories))).rejects.toThrow(
    "Three.js source included in initial static bundle: src/three/particleField.ts",
  );
});

it("requires the background scene to remain a dynamic entry", async () => {
  const directories = await writeFixture(
    manifest({
      "src/three/backgroundScene.ts": { file: "assets/background.js" },
    }),
    {
      "assets/index.js": "index",
      "assets/shared.js": "shared",
      "assets/background.js": "background",
    },
  );

  await expect(checkPerformanceBudgets(budgetOptions(directories))).rejects.toThrow(
    "Deferred Three.js scene was not emitted as a dynamic entry: src/three/backgroundScene.ts",
  );
});

it("rejects MP4 and WebP totals above their budgets", async () => {
  const mp4Directories = await writeFixture(manifest(), {
    "assets/index.js": "index",
    "assets/shared.js": "shared",
    "assets/background.js": "background",
    "static/portfolio/demo.mp4": Buffer.alloc(mp4Budget + 1),
  });
  await expect(checkPerformanceBudgets(budgetOptions(mp4Directories))).rejects.toThrow(
    `MP4 asset budget exceeded: ${mp4Budget + 1} bytes (allowed ${mp4Budget} bytes)`,
  );

  const webpDirectories = await writeFixture(manifest(), {
    "assets/index.js": "index",
    "assets/shared.js": "shared",
    "assets/background.js": "background",
    "static/portfolio/demo.webp": Buffer.alloc(webpBudget + 1),
  });
  await expect(checkPerformanceBudgets(budgetOptions(webpDirectories))).rejects.toThrow(
    `WebP asset budget exceeded: ${webpBudget + 1} bytes (allowed ${webpBudget} bytes)`,
  );
});

it("accepts values at every performance budget boundary", async () => {
  const directories = await writeFixture(manifest(), {
    "assets/index.js": randomBytes(122_802),
    "assets/shared.js": "",
    "assets/background.js": "background",
    "static/portfolio/demo.mp4": Buffer.alloc(mp4Budget),
    "static/portfolio/demo.webp": Buffer.alloc(webpBudget),
  });

  const result = await checkPerformanceBudgets(budgetOptions(directories));

  expect(result.initialJavaScriptGzipBytes).toBe(javascriptBudget);
  expect(result.mp4Bytes).toBe(mp4Budget);
  expect(result.webpBytes).toBe(webpBudget);
});
