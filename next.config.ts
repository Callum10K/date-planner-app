import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    output: 'standalone',
    appDir: true,
    cleanDistDir: true,
};

export default nextConfig;
