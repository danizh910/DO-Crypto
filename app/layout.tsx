import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NoSSR } from "@/components/no-ssr";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "DO Crypto — Banking the Future",
  description: "High-end crypto banking for the modern era. Secure, transparent, testnet-native.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {/* Web3 providers (wagmi/connectkit) must only run client-side */}
        <NoSSR>
          <Providers>{children}</Providers>
        </NoSSR>
      </body>
    </html>
  );
}
