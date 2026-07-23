import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  build: { assetsInlineLimit: 0 },
  test: { environment: "jsdom", include: ["src/**/*.test.ts"] },
});
