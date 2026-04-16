"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import {
  TrendingUp, ArrowUpRight, ArrowDownLeft, ShieldCheck,
  Wallet, AlertCircle, QrCode, ArrowUp, ArrowDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Wallet as WalletType } from "@/lib/supabase/types";
import { sepolia } from "wagmi/chains";
import Link from "next/link";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import { AllocationChart } from "@/components/dashboard/AllocationChart";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address, chainId: sepolia.id });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet]     = useState<WalletType | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName]   = useState("");
  const [loading, setLoading]     = useState(true);
  const [ethPrice, setEthPrice]   = useState<number | null>(null);
  const [ethChange24h, setEthChange24h] = useState<number | null>(null);
  const [stakedEth, setStakedEth] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserEmail(user.email ?? "");

      const [
        { data: txs },
        { data: wallets },
        { data: profile },
        { data: staking },
      ] = await Promise.all([
        supabase.from("transactions").select("*").eq("user_id", user.id)
          .order("created_at", { ascending: false }).limit(5),
        supabase.from("wallets").select("*").eq("user_id", user.id).eq("is_verified", true).limit(1),
        supabase.from("profiles").select("first_name, last_name").eq("id", user.id).single(),
        supabase.from("staking_positions").select("amount").eq("user_id", user.id).eq("status", "active"),
      ]);

      setTransactions(txs ?? []);
      setWallet(wallets?.[0] ?? null);
      if (profile?.first_name) setUserName(`${profile.first_name} ${profile.last_name ?? ""}`.trim());
      const totalStaked = (staking ?? []).reduce((s, p) => s + parseFloat(p.amount ?? "0"), 0);
      setStakedEth(totalStaked);
      setLoading(false);
    }

    async function fetchPrice() {
      try {
        const r = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true"
        );
        const j = await r.json();
        setEthPrice(j?.ethereum?.usd ?? null);
        setEthChange24h(j?.ethereum?.usd_24h_change ?? null);
      } catch { /* ignore */ }
    }

    load();
    fetchPrice();
  }, []);

  const ethFormatted = ethBalance ? parseFloat(formatUnits(ethBalance.value, ethBalance.decimals)) : null;
  const totalUsd     = ethFormatted != null && ethPrice ? (ethFormatted * ethPrice) : null;
  const isUp         = (ethChange24h ?? 0) >= 0;

  const assets = [
    {
      symbol: "ETH", name: "Ethereum",
      amount: ethFormatted != null ? ethFormatted.toFixed(4) : "—",
      usd: ethFormatted != null && ethPrice ? `$${(ethFormatted * ethPrice).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      change: ethChange24h,
      live: true,
    },
    {
      symbol: "stETH", name: "Staked ETH",
      amount: stakedEth > 0 ? stakedEth.toFixed(4) : "—",
      usd: stakedEth > 0 && ethPrice ? `$${(stakedEth * ethPrice).toFixed(2)}` : "—",
      change: ethChange24h,
      live: stakedEth > 0,
    },
    {
      symbol: "USDC", name: "USD Coin",
      amount: "0.00", usd: "$0.00", change: 0, live: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">
          {userName ? `Guten Tag, ${userName.split(" ")[0]}` : "Portfolio"}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{userEmail || "Sepolia Testnet"}</p>
      </motion.div>

      {/* Top stats bar — Kraken-style */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        {[
          {
            label: "Gesamtvermögen",
            value: totalUsd != null ? `$${totalUsd.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
            sub: ethFormatted != null ? `${ethFormatted.toFixed(4)} ETH` : "Wallet verbinden",
            accent: true,
          },
          {
            label: "ETH Preis",
            value: ethPrice ? `$${ethPrice.toLocaleString("de-CH")}` : "—",
            sub: ethChange24h != null
              ? `${isUp ? "▲" : "▼"} ${Math.abs(ethChange24h).toFixed(2)}% (24h)`
              : "Live",
            positive: isUp,
          },
          {
            label: "Staking",
            value: stakedEth > 0 ? `${stakedEth.toFixed(4)} ETH` : "—",
            sub: stakedEth > 0 && ethPrice ? `≈ $${(stakedEth * ethPrice).toFixed(2)}` : "Keine Positionen",
          },
          {
            label: "Satoshi-Test",
            value: loading ? "…" : wallet ? "Verifiziert" : "Ausstehend",
            sub: wallet ? wallet.address.slice(0, 12) + "…" : "Wallet nicht bestätigt",
            verified: !!wallet,
          },
        ].map(({ label, value, sub, accent, positive, verified }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold mt-1 ${accent ? "text-primary" : verified ? "text-success" : "text-foreground"}`}>
              {value}
            </p>
            <p className={`text-xs mt-0.5 ${
              positive !== undefined
                ? positive ? "text-success" : "text-destructive"
                : "text-muted-foreground"
            }`}>
              {sub}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Portfolio chart — large */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-6 col-span-12 md:col-span-8"
        >
          <PortfolioChart ethBalance={ethFormatted} />
        </motion.div>

        {/* Allocation chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl p-6 col-span-12 md:col-span-4"
        >
          <p className="text-xs text-muted-foreground mb-4 font-medium">Allokation</p>
          <AllocationChart ethBalance={ethFormatted} ethPrice={ethPrice} stakedEth={stakedEth} />
        </motion.div>

        {/* Assets table — Kraken-style */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-2xl col-span-12 md:col-span-7 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Assets</p>
            <div className="flex gap-2">
              <Link href="/send" className="flex items-center gap-1.5 text-xs bg-primary/20 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/30 transition-all font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" /> Senden
              </Link>
              <Link href="/receive" className="flex items-center gap-1.5 text-xs border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:text-foreground transition-all font-medium">
                <QrCode className="w-3.5 h-3.5" /> Empfangen
              </Link>
            </div>
          </div>

          {!isConnected ? (
            <div className="px-6 py-8 flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" />
              <span>Verbinde deine Wallet um Assets zu sehen.</span>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {/* Table header */}
              <div className="grid grid-cols-4 px-6 py-2 text-xs text-muted-foreground">
                <span>Asset</span>
                <span className="text-right">Preis</span>
                <span className="text-right">24h</span>
                <span className="text-right">Bestand</span>
              </div>
              {assets.map(asset => (
                <div key={asset.symbol} className="grid grid-cols-4 px-6 py-3 hover:bg-white/3 transition-colors items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {asset.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
                      <p className="text-xs text-muted-foreground">{asset.name}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground text-right">
                    {asset.symbol === "ETH" && ethPrice ? `$${ethPrice.toLocaleString("de-CH")}` : "—"}
                  </p>
                  <div className="flex items-center justify-end gap-1">
                    {asset.change != null && asset.live ? (
                      <span className={`text-xs flex items-center gap-0.5 ${asset.change >= 0 ? "text-success" : "text-destructive"}`}>
                        {asset.change >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {Math.abs(asset.change).toFixed(2)}%
                      </span>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{asset.amount}</p>
                    <p className="text-xs text-muted-foreground">{asset.usd}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent transactions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass rounded-2xl col-span-12 md:col-span-5 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Letzte Transaktionen</p>
            <Link href="/transactions" className="text-xs text-primary hover:underline">Alle →</Link>
          </div>
          {loading ? (
            <div className="px-6 py-8 text-xs text-muted-foreground">Lädt…</div>
          ) : transactions.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-xs text-muted-foreground">Noch keine Transaktionen.</p>
              <Link href="/send" className="text-xs text-primary hover:underline mt-1 inline-block">
                Erste TX senden →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 px-6 py-3 hover:bg-white/3 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${tx.direction === "in" ? "bg-success/10" : "bg-destructive/10"}`}>
                    {tx.direction === "in"
                      ? <ArrowDownLeft className="w-4 h-4 text-success" />
                      : <ArrowUpRight className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {tx.direction === "in" ? "Empfangen" : "Gesendet"}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {tx.tx_hash ? tx.tx_hash.slice(0, 14) + "…" : "pending"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${tx.direction === "in" ? "text-success" : "text-destructive"}`}>
                      {tx.direction === "in" ? "+" : "-"}{parseFloat(tx.amount ?? "0").toFixed(5)} {tx.token ?? "ETH"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "short" }) : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* KYC status / Wallet banner */}
        {!wallet && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="col-span-12 flex items-center gap-4 glass rounded-xl px-5 py-4 border border-yellow-400/20 bg-yellow-400/5"
          >
            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Wallet nicht verifiziert</p>
              <p className="text-xs text-muted-foreground">Schliesse den Satoshi-Test ab um alle Funktionen freizuschalten.</p>
            </div>
            <Link href="/satoshi-test" className="text-xs bg-yellow-400/20 text-yellow-400 px-3 py-1.5 rounded-lg hover:bg-yellow-400/30 transition-all font-medium flex-shrink-0 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Jetzt verifizieren
            </Link>
          </motion.div>
        )}

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="col-span-12"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Senden", icon: ArrowUpRight, href: "/send", color: "text-primary" },
              { label: "Empfangen", icon: QrCode, href: "/receive", color: "text-secondary" },
              { label: "Staking", icon: TrendingUp, href: "/staking", color: "text-success" },
              { label: "KI-Berater", icon: ShieldCheck, href: "/ai", color: "text-yellow-400" },
            ].map(({ label, icon: Icon, href, color }) => (
              <Link
                key={href}
                href={href}
                className="glass rounded-xl p-4 flex items-center gap-3 hover:border-white/15 transition-all group"
              >
                <div className={`w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/8 transition-colors ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-foreground">{label}</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
