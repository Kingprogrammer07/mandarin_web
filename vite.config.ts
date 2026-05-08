import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
      "landscape-slam-boneless.ngrok-free.dev"
    ],
  },
})
