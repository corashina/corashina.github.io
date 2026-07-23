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
