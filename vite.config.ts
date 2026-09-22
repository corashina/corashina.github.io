import react from "@vitejs/plugin-react";
import { blogPlugin } from "./scripts/blog-vite-plugin.mjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/",
  publicDir: "static",
  plugins: [react(), blogPlugin()],
  build: {
    manifest: true,
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true
  }
});
