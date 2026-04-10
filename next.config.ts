import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return `do-crypto-${Date.now()}`;
  },
};

export default nextConfig;
