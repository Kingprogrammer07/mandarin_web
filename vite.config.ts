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
        // The object form buckets a package *and its whole dependency closure*.
        // `{"vendor-charts": ["recharts"]}` therefore swallowed react-dom, the
        // use-sync-external-store shim and clsx, and every chunk that needed
        // one of those — the entry included — had to statically import
        // vendor-charts. Recharts (378 kB / 112 kB gzip) was downloaded on
        // every cold start even though its only two import sites live behind
        // `lazy(() => import("./pages/shared/StatisticsDashboard"))`.
        //
        // The id form buckets one module at a time, so the always-needed
        // packages can be claimed BEFORE recharts gets a chance to absorb them.
        // Order below is load-bearing.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined

          // Claimed first: everything downstream depends on these.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/.test(id))
            return "vendor-react"
          if (/[\\/]node_modules[\\/](clsx|tailwind-merge|class-variance-authority)[\\/]/.test(id))
            return "vendor-ui-utils"

          if (id.includes("node_modules/@tanstack/react-query")) return "vendor-query"
          // d3 / victory-vendor are recharts' own weight — keep them in the
          // lazy chunk instead of letting Rollup strand them in a shared one.
          if (/[\\/]node_modules[\\/](recharts|d3-[a-z]+|victory-vendor|internmap|decimal\.js-light|fast-equals)[\\/]/.test(id))
            return "vendor-charts"
          if (/[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return "vendor-map"
          if (id.includes("node_modules/framer-motion")) return "vendor-motion"
          if (id.includes("node_modules/html5-qrcode")) return "vendor-qr"

          return undefined
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
    // Served through an HTTPS tunnel the page sits on 443, but the HMR client
    // still dials the dev-server port on the tunnel host — nothing forwards
    // that, the socket fails silently, and edits stop hot-applying. Pointing it
    // at wss://<tunnel>:443 fixes it. Guarded by an env var so a plain
    // `npm run dev` on localhost keeps Vite's own defaults:
    //   VITE_TUNNEL_HOST=huff-nape-expiring.ngrok-free.dev npm run dev
    hmr: process.env.VITE_TUNNEL_HOST
      ? {
          protocol: "wss",
          host: process.env.VITE_TUNNEL_HOST,
          clientPort: 443,
        }
      : undefined,
  },
})
