import type { NextConfig } from "next";

// ✅ PERFORMANCE: Bundle analyzer configuration
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

const nextConfig: NextConfig = {
  // ✅ PERFORMANCE: Standalone output for optimized production builds
  output: 'standalone',

  /* other config options here */
};

export default withBundleAnalyzer(nextConfig);
