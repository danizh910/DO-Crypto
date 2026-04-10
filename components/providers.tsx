"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "@/lib/wagmi";
import { useState } from "react";

const connectKitTheme = {
  "--ck-font-family": "inherit",
  "--ck-border-radius": "12px",
  "--ck-overlay-background": "rgba(2, 6, 23, 0.8)",
  "--ck-body-background": "#0F172A",
  "--ck-body-background-secondary": "#1E293B",
  "--ck-body-color": "#F8FAFC",
  "--ck-body-color-muted": "#94A3B8",
  "--ck-primary-button-background": "#22D3EE",
  "--ck-primary-button-color": "#020617",
  "--ck-primary-button-border-radius": "8px",
  "--ck-focus-color": "#22D3EE",
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider customTheme={connectKitTheme}>
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
