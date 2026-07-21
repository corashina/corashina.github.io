import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/showcase/",
  build: { assetsInlineLimit: 0 },
  test: { environment: "jsdom" },
});
