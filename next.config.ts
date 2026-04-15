import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the tracing root to the project directory to avoid multi-lockfile warning
  outputFileTracingRoot: path.join(__dirname),

  // ConnectKit and wagmi are client-only — exclude from server bundle
  serverExternalPackages: ["connectkit", "wagmi", "@wagmi/connectors"],

  // Silence warnings about optional peer deps in wagmi connectors
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "porto/internal": false,
      porto: false,
      "@base-org/account": false,
      "@coinbase/wallet-sdk": false,
      "@metamask/connect-evm": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@walletconnect/ethereum-provider": false,
    };
    return config;
  },
};

export default nextConfig;
