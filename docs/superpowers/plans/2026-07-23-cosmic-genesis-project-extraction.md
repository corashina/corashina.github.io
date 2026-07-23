# Cosmic Genesis Project Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Cosmic Genesis into `C:\Users\Tomasz\Documents\Projects\cosmic-genesis` as a portable standalone project and remove it completely from the portfolio worktree.

**Architecture:** First adapt the existing isolated `showcase/` application to run at a portable root URL and verify those changes in place. Copy only tracked project files and Cosmic Genesis documentation to the exact destination, verify file hashes, install and test the destination, and only then remove the portfolio copies. The destination remains a normal folder without a `.git` repository.

**Tech Stack:** TypeScript 7, Vite 8, Three.js 0.185, Vitest 4, Playwright 1.61, PowerShell, npm.

## Global Constraints

- Destination: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis`.
- Do not initialize a Git repository in the destination.
- Do not transfer `node_modules`, `dist`, `test-results`, `playwright-report`, logs, or other generated output.
- Stop before deleting portfolio files if the destination cannot be created, copied, hash-verified, installed, built, or tested.
- Stop rather than overwrite a non-empty destination without explicit user approval.
- Preserve visual behavior, particle defaults, controls, FPS reporting, accessibility, reduced motion, context recovery, and resource cleanup.
- The standalone project must contain no portfolio build command and no `/showcase/` runtime dependency.

---

### Task 1: Convert the application to portable root hosting

**Files:**
- Create: `showcase/src/standalone-config.test.ts`
- Create: `showcase/.gitignore`
- Modify: `showcase/vite.config.ts`
- Modify: `showcase/index.html`
- Modify: `showcase/package.json`
- Modify: `showcase/package-lock.json`
- Modify: `showcase/playwright.config.ts`
- Modify: `showcase/e2e/showcase.e2e.ts`
- Modify: `showcase/scripts/capture-fallback.mjs`
- Modify: `showcase/README.md`

**Interfaces:**
- Consumes: the existing Vite application and its `/showcase/` URL contract.
- Produces: a project whose development and production entry point is `/`, whose built assets use relative URLs, and whose verification scripts terminate without an npm-owned preview subprocess.

- [ ] **Step 1: Write the failing standalone-boundary test**

Create `showcase/src/standalone-config.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

const read = (path: string): string => readFileSync(path, "utf8");

describe("standalone project boundary", () => {
  it("uses portable root paths and no portfolio deployment hook", () => {
    const vite = read("vite.config.ts");
    const playwright = read("playwright.config.ts");
    const e2e = read("e2e/showcase.e2e.ts");
    const capture = read("scripts/capture-fallback.mjs");
    const readme = read("README.md");
    const packageJson = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(vite).toContain('base: "./"');
    expect(document.querySelector(".showcase-fallback img")?.getAttribute("src")).toBe("./fallback.png");
    expect(document.querySelector('script[type="module"]')?.getAttribute("src")).toBe("./src/main.ts");
    expect(packageJson.scripts["build:portfolio"]).toBeUndefined();
    expect(playwright).toContain('url: "http://127.0.0.1:4174/"');
    expect(playwright).toContain('"node node_modules/vite/bin/vite.js preview');

    for (const source of [vite, playwright, e2e, capture, readme, html]) {
      expect(source).not.toContain("/showcase/");
    }
  });

  it("ignores standalone generated output", () => {
    const gitignore = read(".gitignore");
    expect(gitignore).toContain("node_modules/");
    expect(gitignore).toContain("dist/");
    expect(gitignore).toContain("test-results/");
    expect(gitignore).toContain("playwright-report/");
  });
});
```

- [ ] **Step 2: Run the test and verify the portfolio coupling is detected**

Run from `showcase/`:

```powershell
npx.cmd vitest run src/standalone-config.test.ts
```

Expected: FAIL on the `/showcase/` base, fallback path, portfolio build script, Playwright route, and missing standalone `.gitignore`.

- [ ] **Step 3: Implement the portable Vite and HTML boundary**

Change `showcase/vite.config.ts` to:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: { assetsInlineLimit: 0 },
  test: { environment: "jsdom", include: ["src/**/*.test.ts"] },
});
```

In `showcase/index.html`, use portable document-relative paths:

```html
<img src="./fallback.png" alt="Cosmic Genesis abstract artwork" />
<script type="module" src="./src/main.ts"></script>
```

Create `showcase/.gitignore`:

```gitignore
node_modules/
dist/
test-results/
playwright-report/
*.log
```

- [ ] **Step 4: Remove the portfolio package command**

Delete `build:portfolio` from `showcase/package.json`. Run:

```powershell
npm.cmd install --package-lock-only --ignore-scripts
```

Expected: `package-lock.json` remains valid, with no dependency version changes.

- [ ] **Step 5: Convert browser verification to the root URL**

In `showcase/playwright.config.ts`, change the web server to:

```ts
webServer: {
  command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174",
  url: "http://127.0.0.1:4174/",
  reuseExistingServer: !process.env.CI,
  timeout: 120_000,
},
```

The `verify` package script already runs the build before browser tests, so Playwright only needs to own one direct Vite process.

In `showcase/e2e/showcase.e2e.ts`, replace every `page.goto("/showcase/...")` with the equivalent root navigation:

```ts
await page.goto("/?test=1");
await page.goto("/");
```

Rename the direct-route test to:

```ts
test("serves direct root navigation without test instrumentation", async ({ page }) => {
```

- [ ] **Step 6: Convert fallback capture to the root URL**

In `showcase/scripts/capture-fallback.mjs`, use:

```js
const response = await fetch(`http://127.0.0.1:${port}/`);
```

and:

```js
await page.goto(`http://127.0.0.1:${port}/?capture=1&test=1`, {
  waitUntil: "networkidle",
});
```

- [ ] **Step 7: Rewrite the README for destination-root commands**

Replace `showcase/README.md` with:

````md
# Cosmic Genesis

A standalone interactive Three.js particle simulation with live scene controls
and an FPS monitor.

## Requirements

- Node.js 24.15 or newer
- npm 11.12 or newer

## Run locally

```powershell
npm install
npm run dev
```

Open the URL printed by Vite.

## Verify

```powershell
npm run typecheck
npm test
npm run build
npm run test:browser -- --project=chromium
```

## Production preview

```powershell
npm run build
npm run preview
```

## Refresh the fallback artwork

```powershell
npm run capture:fallback
```

The capture command preserves the existing fallback when the available WebGL
renderer returns a blank framebuffer.
````

- [ ] **Step 8: Run focused and full project checks**

Run from `showcase/`:

```powershell
npx.cmd vitest run src/standalone-config.test.ts src/showcase-shell.test.ts
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Expected: standalone tests pass, all unit tests pass, and `dist/index.html` contains relative `./assets/` URLs rather than `/showcase/` URLs.

- [ ] **Step 9: Commit the portable application**

Run from the portfolio worktree root:

```powershell
git add -- showcase/.gitignore showcase/vite.config.ts showcase/index.html showcase/package.json showcase/package-lock.json showcase/playwright.config.ts showcase/e2e/showcase.e2e.ts showcase/scripts/capture-fallback.mjs showcase/README.md showcase/src/standalone-config.test.ts
git commit -m "refactor: make cosmic genesis standalone"
```

---

### Task 2: Copy and hash-verify the standalone folder

**Files:**
- Create: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis\**`
- Preserve temporarily: `showcase/**`
- Preserve temporarily: the Cosmic Genesis files under `docs/superpowers/`

**Interfaces:**
- Consumes: the committed portable `showcase/` tree from Task 1.
- Produces: a clean destination containing the project at its root, plus its documentation under `docs/superpowers/`.

- [ ] **Step 1: Confirm the exact source and destination**

Run from the portfolio worktree root:

```powershell
$sourceRoot = (git rev-parse --show-toplevel).Trim()
$targetRoot = 'C:\Users\Tomasz\Documents\Projects\cosmic-genesis'
$sourceRoot
$targetRoot
```

Expected source:

```text
C:\Users\Tomasz\Documents\Projects\corashina.github.io\.worktrees\cosmic-genesis-showcase
```

Expected destination:

```text
C:\Users\Tomasz\Documents\Projects\cosmic-genesis
```

- [ ] **Step 2: Refuse to overwrite an existing non-empty destination**

Run:

```powershell
if (Test-Path -LiteralPath $targetRoot) {
  $existing = @(Get-ChildItem -LiteralPath $targetRoot -Force)
  if ($existing.Count -gt 0) {
    throw "Destination exists and is non-empty: $targetRoot"
  }
} else {
  New-Item -ItemType Directory -Path $targetRoot | Out-Null
}
```

Expected: a new empty destination, or a hard stop without changing it.

- [ ] **Step 3: Copy only tracked application files**

Run:

```powershell
$projectFiles = @(git ls-files -- showcase)
foreach ($repoPath in $projectFiles) {
  $relative = $repoPath.Substring('showcase/'.Length)
  $source = Join-Path $sourceRoot $repoPath
  $destination = Join-Path $targetRoot $relative
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
```

Expected: the destination contains `package.json`, `src/`, `e2e/`, `public/`, and project configuration, but no generated directories.

- [ ] **Step 4: Copy the exact project documentation**

Run:

```powershell
$docFiles = @(
  git ls-files -- `
    'docs/superpowers/specs/*cosmic-genesis*' `
    'docs/superpowers/specs/*particle-only-showcase*' `
    'docs/superpowers/specs/*particle-lab-controls*' `
    'docs/superpowers/plans/*cosmic-genesis*' `
    'docs/superpowers/plans/*particle-only-showcase*' `
    'docs/superpowers/plans/*particle-lab-controls*'
)
foreach ($repoPath in $docFiles) {
  $source = Join-Path $sourceRoot $repoPath
  $destination = Join-Path $targetRoot $repoPath
  $destinationDirectory = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
```

- [ ] **Step 5: Verify every copied file by SHA-256**

Run:

```powershell
$copyErrors = @()
foreach ($repoPath in $projectFiles) {
  $relative = $repoPath.Substring('showcase/'.Length)
  $source = Join-Path $sourceRoot $repoPath
  $destination = Join-Path $targetRoot $relative
  if (!(Test-Path -LiteralPath $destination) -or
      (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne
      (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash) {
    $copyErrors += $repoPath
  }
}
foreach ($repoPath in $docFiles) {
  $source = Join-Path $sourceRoot $repoPath
  $destination = Join-Path $targetRoot $repoPath
  if (!(Test-Path -LiteralPath $destination) -or
      (Get-FileHash -Algorithm SHA256 -LiteralPath $source).Hash -ne
      (Get-FileHash -Algorithm SHA256 -LiteralPath $destination).Hash) {
    $copyErrors += $repoPath
  }
}
if ($copyErrors.Count -gt 0) {
  throw "Copy verification failed: $($copyErrors -join ', ')"
}
```

Expected: no output and no exception.

- [ ] **Step 6: Assert generated content and Git metadata were not copied**

Run:

```powershell
$forbidden = @('.git', 'node_modules', 'dist', 'test-results', 'playwright-report')
foreach ($name in $forbidden) {
  if (Test-Path -LiteralPath (Join-Path $targetRoot $name)) {
    throw "Generated or repository content was copied: $name"
  }
}
```

Expected: no output and no exception.

---

### Task 3: Verify the destination before removing the portfolio copy

**Files:**
- Generate temporarily: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis\node_modules\`
- Generate temporarily: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis\dist\`
- Generate temporarily: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis\test-results\`

**Interfaces:**
- Consumes: the hash-verified standalone folder from Task 2.
- Produces: independent installation, unit, build, and browser evidence for the destination.

- [ ] **Step 1: Install exact locked dependencies**

Run from `C:\Users\Tomasz\Documents\Projects\cosmic-genesis`:

```powershell
npm.cmd ci
```

Expected: exit code 0 and dependencies installed from `package-lock.json`.

- [ ] **Step 2: Run type and unit verification**

Run:

```powershell
npm.cmd run typecheck
npm.cmd test
```

Expected: TypeScript exits 0 and all unit tests, including the standalone-boundary tests, pass.

- [ ] **Step 3: Build the portable output and inspect asset paths**

Run:

```powershell
npm.cmd run build
rg -n "/showcase/|corashina|build:portfolio" package.json README.md index.html vite.config.ts playwright.config.ts e2e scripts src dist
Get-Content -Raw dist/index.html
```

Expected: build exits 0; the search returns no matches; `dist/index.html` uses relative `./assets/` URLs.

- [ ] **Step 4: Run Chromium verification**

Run:

```powershell
npm.cmd run test:browser -- --project=chromium
```

Expected: all nine Chromium scenarios pass and the command terminates normally after the direct Vite preview is stopped.

- [ ] **Step 5: Gate portfolio removal on evidence**

Do not continue to Task 4 unless Steps 1–4 all exited successfully. If any check fails, keep the portfolio copy untouched and fix the destination first.

---

### Task 4: Remove Cosmic Genesis from the portfolio worktree

**Files:**
- Delete: `showcase/**`
- Delete: `docs/superpowers/specs/2026-07-21-cosmic-genesis-webgl-showcase-design.md`
- Delete: `docs/superpowers/specs/2026-07-22-particle-only-showcase-design.md`
- Delete: `docs/superpowers/specs/2026-07-22-particle-lab-controls-design.md`
- Delete: `docs/superpowers/specs/2026-07-23-cosmic-genesis-project-extraction-design.md`
- Delete: `docs/superpowers/plans/2026-07-21-cosmic-genesis-webgl-showcase.md`
- Delete: `docs/superpowers/plans/2026-07-22-particle-only-showcase.md`
- Delete: `docs/superpowers/plans/2026-07-22-particle-lab-controls.md`
- Delete: `docs/superpowers/plans/2026-07-23-cosmic-genesis-project-extraction.md`
- Delete if present: ignored generated `public/showcase/**`

**Interfaces:**
- Consumes: successful destination verification from Task 3.
- Produces: a portfolio worktree with no active Cosmic Genesis source, assets, deployment hook, or project documentation.

- [ ] **Step 1: Remove the tracked project and exact documentation**

Run from the portfolio worktree root:

```powershell
git rm -r -- showcase
git rm -- `
  docs/superpowers/specs/2026-07-21-cosmic-genesis-webgl-showcase-design.md `
  docs/superpowers/specs/2026-07-22-particle-only-showcase-design.md `
  docs/superpowers/specs/2026-07-22-particle-lab-controls-design.md `
  docs/superpowers/specs/2026-07-23-cosmic-genesis-project-extraction-design.md `
  docs/superpowers/plans/2026-07-21-cosmic-genesis-webgl-showcase.md `
  docs/superpowers/plans/2026-07-22-particle-only-showcase.md `
  docs/superpowers/plans/2026-07-22-particle-lab-controls.md `
  docs/superpowers/plans/2026-07-23-cosmic-genesis-project-extraction.md
```

- [ ] **Step 2: Remove only the exact ignored generated deployment directory if present**

Resolve and validate the exact target:

```powershell
$worktreeRoot = (git rev-parse --show-toplevel).Trim()
$generatedShowcase = [System.IO.Path]::GetFullPath((Join-Path $worktreeRoot 'public\showcase'))
$expectedShowcase = [System.IO.Path]::GetFullPath("$worktreeRoot\public\showcase")
if ($generatedShowcase -ne $expectedShowcase) {
  throw "Generated showcase path validation failed."
}
if (Test-Path -LiteralPath $generatedShowcase) {
  Remove-Item -LiteralPath $generatedShowcase -Recurse -Force
}
```

- [ ] **Step 3: Confirm the portfolio has no current project references**

Run:

```powershell
rg -n -i "cosmic genesis|cosmic-genesis|/showcase/|build:portfolio" `
  --glob '!.git/**' `
  --glob '!node_modules/**' `
  --glob '!public/**' .
```

Expected: no matches.

- [ ] **Step 4: Verify the portfolio still passes**

Run from the portfolio worktree root:

```powershell
npm.cmd test
npm.cmd run build
git diff --check
```

Expected: portfolio unit tests and production build pass; Git reports no whitespace errors.

- [ ] **Step 5: Commit the portfolio removal**

Run:

```powershell
git add -u -- showcase docs/superpowers
git commit -m "chore: move cosmic genesis out of portfolio"
```

---

### Task 5: Launch and inspect the standalone handoff

**Files:**
- Read-only verification: `C:\Users\Tomasz\Documents\Projects\cosmic-genesis\dist\`

**Interfaces:**
- Consumes: the verified destination and cleaned portfolio worktree.
- Produces: a live standalone root preview for user testing.

- [ ] **Step 1: Start the destination preview**

Run from `C:\Users\Tomasz\Documents\Projects\cosmic-genesis`:

```powershell
node.exe node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174
```

Expected: Vite serves `http://127.0.0.1:4174/`.

- [ ] **Step 2: Inspect the live application**

Open `http://127.0.0.1:4174/` and confirm:

- visible moving particles;
- default speed value `3`;
- all seven parameter sliders;
- updating FPS output;
- Reset View and Reset Parameters work;
- the Particle Lab can collapse and expand;
- no browser console errors;
- the URL contains no `/showcase/` segment.

- [ ] **Step 3: Run final filesystem and Git checks**

Run:

```powershell
Test-Path -LiteralPath 'C:\Users\Tomasz\Documents\Projects\cosmic-genesis\package.json'
Test-Path -LiteralPath 'C:\Users\Tomasz\Documents\Projects\cosmic-genesis\.git'
git status --short
git log -2 --oneline
```

Expected: the package exists, `.git` is absent, the portfolio worktree is clean, and the extraction/removal commits are visible.
