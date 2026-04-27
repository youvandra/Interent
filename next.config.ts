import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Turbopack from picking a parent directory lockfile as the root.
    // Use the directory where `next` is executed.
    root: process.cwd(),
  },
};

export default nextConfig;
