import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geliştirme sunucusunda sol altta çıkan Next.js göstergesini gizle (derleme/çalışma hataları yine gösterilir).
  devIndicators: false,
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
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
