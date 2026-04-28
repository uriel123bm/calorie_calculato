import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png", "favicon-32.png"],
      manifest: {
        name: "מחשבון קלוריות",
        short_name: "קלוריות",
        description: "מחשב קלוריות למתכונים ומעקב יומי",
        theme_color: "#0f5238",
        background_color: "#f8f9fa",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        lang: "he",
        dir: "rtl",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        categories: ["health", "food"],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // API calls must not go through workbox cache strategies. Caching
        // cross-origin /auth, /sync, POST /ingredients can break 401 handling
        // and has caused runtime errors in the minified service worker
        // (e.g. reading .payload on failed responses).
        runtimeCaching: [
          // Same-origin FastAPI under Vercel experimentalServices — must never be cached
          // by Workbox (stale 401/500 bodies or opaque errors in the SW have caused 500s in DevTools).
          {
            urlPattern: /\/_\/?backend\//,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /\/\/(?:.*\.)?onrender\.com\//i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https?:\/\/127\.0\.0\.1:8000\//i,
            handler: "NetworkOnly",
          },
          {
            urlPattern: /^https?:\/\/localhost:8000\//i,
            handler: "NetworkOnly",
          },
        ],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,          // expose on 0.0.0.0 — reachable from phone on same WiFi
    proxy: {
      "/ingredients": "http://127.0.0.1:8000",
      "/recipe":      "http://127.0.0.1:8000",
      "/auth":        "http://127.0.0.1:8000",
      "/sync":        "http://127.0.0.1:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
});
