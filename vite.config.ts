import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig, type Plugin } from "vite"

// Unique per build. Baked into the bundle as `__BUILD_ID__` and written to
// `version.json` so a running client can detect that a newer deploy exists
// (see src/utils/appUpdate.ts) and prompt the user to reload.
const BUILD_ID = Date.now().toString(36)

// Emits `version.json` into the build output with the current BUILD_ID.
// Served by the CDN; the client polls it and compares against its baked-in id.
const emitVersionJson = (): Plugin => ({
  name: "emit-version-json",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ buildId: BUILD_ID }),
    })
  },
})

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [react(), tailwindcss(), emitVersionJson()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Suppress warning for the main entry chunk — React 19 + app shell is unavoidably large.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // NOTE: react/react-dom cannot be extracted from the entry chunk — Rollup keeps
          // them inline when the entry directly depends on them. Specifying them here
          // produces an empty chunk, so they are intentionally omitted.
          "vendor-query": ["@tanstack/react-query"],
          "vendor-charts": ["recharts"],
          "vendor-map": ["leaflet", "react-leaflet"],
          "vendor-motion": ["framer-motion"],
          "vendor-qr": ["html5-qrcode"],
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      "huff-nape-expiring.ngrok-free.dev"
    ],
  },
})
