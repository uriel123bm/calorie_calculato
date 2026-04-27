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
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\/ingredients\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-ingredients",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
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
    },
  },
});
