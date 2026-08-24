import path from "path"
import { defineConfig } from "vitest/config"

// Deliberately standalone rather than merged into vite.config.ts.
//
// vite.config.ts drives the PRODUCTION build of a live app: it stamps a
// BUILD_ID from Date.now(), emits version.json for the update prompt, and
// tunes manual chunks. Test configuration has no business in that file, and a
// mistake there would ship, not just fail a test run.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Only real test files. The app itself is never collected.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.{test,spec}.{ts,tsx}", "src/test/**", "src/i18n/locales/**"],
    },
  },
})
