import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /testproj/; the dev server uses the root.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/testproj/" : "/",
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
