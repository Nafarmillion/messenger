import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable dev tracing to prevent continuous file writes
  devIndicators: false,

  // Disable React Strict Mode in dev to prevent double-mounting and duplicate renders
  reactStrictMode: false,

  turbopack: {
    // Disable persistent cache to prevent unbounded disk writes and memory growth
    persistentCaching: false,
  },
};

export default nextConfig;
