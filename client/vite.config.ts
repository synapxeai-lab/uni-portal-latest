import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Tailwind runs as a Vite plugin; an inline (empty) PostCSS config stops
  // Vite from searching parent directories for one.
  css: { postcss: {} },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // "client" is this service's hostname inside the compose network (used
    // by the Playwright UI checks).
    allowedHosts: ["localhost", "client"],
    // Same-origin API in development: /api is proxied to the Express server,
    // so the httpOnly session cookie needs no CORS setup.
    proxy: {
      "/api": { target: apiTarget, changeOrigin: false, xfwd: true },
    },
    // Bind mounts on Windows/macOS don't forward file events, so Docker dev
    // polls - but only the source folders, and not too often: polling a
    // large tree starves the dev server (and its /api proxy) of CPU.
    watch: process.env.VITE_POLL_WATCH
      ? {
          usePolling: true,
          interval: 1000,
          binaryInterval: 3000,
          ignored: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/public/**"],
        }
      : undefined,
  },
  build: {
    target: "es2022",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Long-lived chunks for the core libraries every page uses, so app
        // deploys don't invalidate the browser's cached copy of them.
        manualChunks(id) {
          if (!id.includes("/node_modules/")) {
            return undefined;
          }
          if (/\/node_modules\/(react|react-dom|scheduler|react-router)\//.test(id)) {
            return "react";
          }
          if (id.includes("/node_modules/@radix-ui/")) {
            return "radix";
          }
          if (/\/node_modules\/(@tanstack|axios|zod)\//.test(id)) {
            return "data";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "icons";
          }
          // Everything else is split by Rollup with the pages that use it
          // (e.g. drag-and-drop ships only with the Classwork page).
          return undefined;
        },
      },
    },
  },
});
