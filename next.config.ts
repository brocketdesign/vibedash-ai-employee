import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // Production optimizations
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },

  // Security headers handled in vercel.json; keep logging lean
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },

  // Allow Clerk & external API domains for server actions
  serverExternalPackages: ["mongodb"],
};

export default nextConfig;
