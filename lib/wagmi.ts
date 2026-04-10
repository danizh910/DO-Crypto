import { createConfig, http } from "wagmi";
import { sepolia, baseSepolia } from "wagmi/chains";
import { getDefaultConfig } from "connectkit";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [sepolia, baseSepolia],
    transports: {
      [sepolia.id]: http(
        process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
          ? `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : undefined
      ),
      [baseSepolia.id]: http(
        process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
          ? `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
          : undefined
      ),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
    appName: "DO Crypto",
    appDescription: "High-End Crypto Banking on Testnet",
  })
);
