import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme sunucusunda sol altta çıkan Next.js göstergesini gizle (derleme/çalışma hataları yine gösterilir).
  devIndicators: false,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // Service worker her zaman güncel sürümüyle alınsın ve yalnızca aynı kökenden betik çalıştırabilsin.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
