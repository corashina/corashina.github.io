# Task 10 Report — Browser Verification and Portfolio Output

## RED

- The new Playwright suite first failed because the pinned Chromium 1.61.1 executable was not installed. Installing Chromium completed successfully.
- With Chromium installed, the production route entered the expected compatibility fallback because headless Chromium reported no WebGL 2 context. Enabling ANGLE SwiftShader in the Chromium Playwright project made the production-base smoke test pass.
- The initial Vitest command tried to collect `e2e/showcase.spec.ts` and failed with Playwright's `test() did not expect test() to be called here` diagnostic. Vitest now includes only `src/**/*.test.ts`.

## GREEN / Evidence

- `npm.cmd run test`: 25 files, 127 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run build:portfolio`: passed; generated `public/showcase/index.html` referenced `/showcase/assets/...` and `/showcase/fallback.png`. The generated directory was inspected, then removed.
- Chromium focused browser evidence passed for first context restoration (15.9s) and static fallback after the second context loss (23.7s). The latter command exceeded its 60-second process bound only during Windows Playwright web-server teardown after reporting the test as `ok`.
- The bounded final full Chromium run reported tests 1–7 as `ok`; previous focused evidence also covers test 8, and the direct production navigation test passed in the earlier full run. The runner's process teardown prevents one clean all-nine completion in this host within the task time bound.

## Fallback Asset

- The capture script correctly waits for production readiness, settles for two seconds, hides controls, bounds screenshots, and shuts down preview in `finally`.
- In this Windows SwiftShader environment, framebuffer screenshots were transparent/blank (6,989 bytes) despite renderer-ready state. The script now captures to a temporary candidate, rejects blank output below 20 KB, and preserves the committed asset.
- The committed reviewed PNG is 960 × 600 and 1,375,755 bytes, below the 1.5 MB limit.

## Concerns

- Refreshing the fallback requires a GPU-capable capture host; this host cannot produce a nonblank WebGL screenshot through SwiftShader.
- Playwright's Windows `webServer` lifecycle does not exit cleanly after a passing run in this environment. Browser runs were bounded and focused evidence was retained instead of waiting indefinitely.
