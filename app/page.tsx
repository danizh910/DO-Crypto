"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ShieldCheck, TrendingUp, Vault, ArrowRight } from "lucide-react";

const features = [
  {
    icon: Vault,
    title: "Secure Vaults",
    description: "Segregierte Wallets mit multi-layer Compliance-Prüfung und Satoshi-Verification.",
  },
  {
    icon: TrendingUp,
    title: "DeFi Staking",
    description: "Direkte Integration mit Lido und Aave — APY transparent in Echtzeit.",
  },
  {
    icon: ShieldCheck,
    title: "Compliance-Native",
    description: "Satoshi-Test verifiziert die Eigentümerschaft einer Wallet kryptografisch.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full bg-secondary/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24">
        {/* Header */}
        <nav className="flex items-center justify-between mb-24">
          <span className="text-xl font-bold">
            <span className="text-primary">DO</span>
            <span className="text-foreground"> Crypto</span>
          </span>
          <Link
            href="/login"
            className="bg-primary text-background text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-primary/90 transition-all"
          >
            Portal öffnen
          </Link>
        </nav>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs px-4 py-1.5 rounded-full mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Sepolia Testnet Live
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
            Banking für das<br />
            <span className="text-primary">dezentrale Zeitalter.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            DO Crypto verbindet institutionelle Banking-Standards mit der Transparenz der Blockchain.
            Vaults, Staking und Compliance — alles in einer Oberfläche.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-primary text-background font-semibold px-8 py-3.5 rounded-xl hover:bg-primary/90 transition-all text-sm"
          >
            Konto eröffnen
            <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, description }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="glass rounded-2xl p-6"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}
