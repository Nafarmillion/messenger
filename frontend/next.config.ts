import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    // Disable persistent cache to prevent unbounded disk writes and memory growth
    persistentCaching: false,
  },
};

export default nextConfig;
