import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DEFAULT_JAVASCRIPT_BUDGET = 120 * 1024;
const DEFAULT_MP4_BUDGET = 10 * 1024 * 1024;
const DEFAULT_WEBP_BUDGET = 500 * 1024;
const BACKGROUND_SCENE_ENTRY = "src/three/backgroundScene.ts";

/**
 * Returns the manifest chunks loaded by an entry before any dynamic imports.
 *
 * @param {Record<string, { imports?: string[] }>} manifest
 * @param {string} entryKey
 */
export function collectStaticManifestEntries(manifest, entryKey) {
  const entries = [];
  const seen = new Set();

  function visit(key) {
    if (seen.has(key)) return;
    seen.add(key);

    const entry = manifest[key];
    if (!entry) {
      throw new Error(`Manifest entry not found: ${key}`);
    }

    entries.push(key);
    for (const importedKey of entry.imports ?? []) {
      visit(importedKey);
    }
  }

  visit(entryKey);
  return entries;
}

/** @param {string} directory */
async function collectFiles(directory) {
  const directoryEntries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    directoryEntries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return files.flat();
}

/**
 * @param {string} directory
 * @param {string} extension
 */
async function totalAssetBytes(directory, extension) {
  const files = await collectFiles(directory);
  const matchingFiles = files.filter((file) => file.toLowerCase().endsWith(extension));
  const sizes = await Promise.all(matchingFiles.map((file) => stat(file)));
  return sizes.reduce((total, file) => total + file.size, 0);
}

/**
 * @param {Record<string, { src?: string; isDynamicEntry?: boolean }>} manifest
 */
function findDynamicBackgroundScene(manifest) {
  return Object.entries(manifest).find(
    ([key, entry]) =>
      (key === BACKGROUND_SCENE_ENTRY || entry.src === BACKGROUND_SCENE_ENTRY) &&
      entry.isDynamicEntry === true,
  );
}

/**
 * @param {{
 *   distDirectory?: string;
 *   staticDirectory?: string;
 *   entryKey?: string;
 *   javascriptBudget?: number;
 *   mp4Budget?: number;
 *   webpBudget?: number;
 *   logger?: (message: string) => void;
 * }} [options]
 */
export async function checkPerformanceBudgets(options = {}) {
  const {
    distDirectory = "dist",
    staticDirectory = "static/portfolio",
    entryKey = "index.html",
    javascriptBudget = DEFAULT_JAVASCRIPT_BUDGET,
    mp4Budget = DEFAULT_MP4_BUDGET,
    webpBudget = DEFAULT_WEBP_BUDGET,
    logger = console.log,
  } = options;
  const manifestPath = join(distDirectory, ".vite", "manifest.json");
  /** @type {Record<string, { file?: string; src?: string; imports?: string[]; isDynamicEntry?: boolean }>} */
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const staticEntries = collectStaticManifestEntries(manifest, entryKey);
  const staticThreeEntry = staticEntries
    .map((key) => {
      const source = manifest[key].src;
      return source?.startsWith("src/three/")
        ? source
        : key.startsWith("src/three/")
          ? key
          : undefined;
    })
    .find(Boolean);

  if (staticThreeEntry) {
    throw new Error(
      `Three.js source included in initial static bundle: ${staticThreeEntry}`,
    );
  }

  const dynamicBackgroundScene = findDynamicBackgroundScene(manifest);
  if (!dynamicBackgroundScene) {
    throw new Error(
      `Deferred Three.js scene was not emitted as a dynamic entry: ${BACKGROUND_SCENE_ENTRY}`,
    );
  }

  const staticJavaScriptFiles = [
    ...new Set(
      staticEntries
        .map((key) => manifest[key].file)
        .filter((file) => file?.toLowerCase().endsWith(".js")),
    ),
  ];
  const initialJavaScriptGzipBytes = (
    await Promise.all(
      staticJavaScriptFiles.map(async (file) =>
        gzipSync(await readFile(join(distDirectory, file))).byteLength,
      ),
    )
  ).reduce((total, bytes) => total + bytes, 0);

  if (initialJavaScriptGzipBytes > javascriptBudget) {
    throw new Error(
      `Initial JavaScript gzip budget exceeded: ${initialJavaScriptGzipBytes} bytes (allowed ${javascriptBudget} bytes)`,
    );
  }

  const mp4Bytes = await totalAssetBytes(staticDirectory, ".mp4");
  if (mp4Bytes > mp4Budget) {
    throw new Error(
      `MP4 asset budget exceeded: ${mp4Bytes} bytes (allowed ${mp4Budget} bytes)`,
    );
  }

  const webpBytes = await totalAssetBytes(staticDirectory, ".webp");
  if (webpBytes > webpBudget) {
    throw new Error(
      `WebP asset budget exceeded: ${webpBytes} bytes (allowed ${webpBudget} bytes)`,
    );
  }

  const deferredSceneChunk = dynamicBackgroundScene[1].file ?? dynamicBackgroundScene[0];
  logger(
    `Performance budgets: initial gzip ${initialJavaScriptGzipBytes} B, MP4 ${mp4Bytes} B, WebP ${webpBytes} B, deferred scene ${deferredSceneChunk}`,
  );

  return {
    initialJavaScriptGzipBytes,
    mp4Bytes,
    webpBytes,
    deferredSceneChunk,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await checkPerformanceBudgets();
}
