# Cosmic Genesis Showcase

The standalone Vite application builds independently and deploys beneath `/showcase/`.

```bash
npm --prefix showcase install
npm --prefix showcase run dev
npm --prefix showcase run verify
npm --prefix showcase run capture:fallback
npm --prefix showcase run build:portfolio
```

`build:portfolio` writes generated showcase files to `public/showcase` after the portfolio build. It changes no portfolio source file; inspect the generated output and leave it uncommitted.

Browser coverage uses Chromium in automated verification. Firefox and WebKit projects remain available locally through `npm --prefix showcase run test:browser -- --project=<browser>` when those Playwright browsers are installed.

The committed fallback is a reviewed static composition. On this Windows SwiftShader runner, production capture reaches renderer-ready state but returns a blank framebuffer; `capture:fallback` detects that case and preserves the approved fallback instead of replacing it. Run the command on a GPU-capable capture host to refresh the image.
