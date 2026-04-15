"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { TrendingUp, ArrowUpRight, ArrowDownLeft, ShieldCheck, Coins, Wallet, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Wallet as WalletType } from "@/lib/supabase/types";
import { sepolia } from "wagmi/chains";
import Link from "next/link";

const card = "glass rounded-2xl p-6";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address, chainId: sepolia.id });

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      setUserEmail(user.email ?? "");

      const [{ data: txs }, { data: wallets }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("wallets")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_verified", true)
          .limit(1),
      ]);

      setTransactions(txs ?? []);
      setWallet(wallets?.[0] ?? null);
      setLoading(false);
    }
    load();
  }, []);

  const ethFormatted = ethBalance
    ? formatUnits(ethBalance.value, ethBalance.decimals)
    : null;
  const ethValue = ethFormatted
    ? (parseFloat(ethFormatted) * 2450).toFixed(2)
    : "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {userEmail || "Sepolia Testnet"}
        </p>
      </motion.div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Total Balance */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${card} col-span-12 md:col-span-8`}
        >
          <p className="text-muted-foreground text-sm">Wallet-Guthaben (Sepolia ETH)</p>
          {isConnected ? (
            <>
              <p className="text-4xl font-bold text-foreground mt-2">
                {ethFormatted ? parseFloat(ethFormatted).toFixed(4) : "…"}{" "}
                <span className="text-primary text-2xl">ETH</span>
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                ≈ ${ethValue} <span className="text-xs">(Testnet-Preis simuliert)</span>
              </p>
              <div className="flex items-center gap-1 mt-2 text-success text-sm">
                <TrendingUp className="w-4 h-4" />
                <span>Sepolia Testnet</span>
              </div>
            </>
          ) : (
            <div className="mt-4 flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="w-4 h-4" />
              <span>Verbinde deine Wallet um den Saldo zu sehen.</span>
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Link
              href="/send"
              className="bg-primary text-background text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-4 h-4" /> Senden
            </Link>
            <Link
              href="/staking"
              className="border border-border text-muted-foreground text-sm font-medium px-5 py-2 rounded-lg hover:border-foreground/20 hover:text-foreground transition-all flex items-center gap-1.5"
            >
              <TrendingUp className="w-4 h-4" /> Staken
            </Link>
          </div>
        </motion.div>

        {/* Satoshi Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${card} col-span-12 md:col-span-4 flex flex-col justify-between`}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Satoshi-Test</span>
          </div>
          {loading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Lädt…</div>
          ) : wallet ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6 text-success" />
              </div>
              <p className="text-success font-semibold mt-2 text-sm">Verifiziert</p>
              <p className="text-muted-foreground text-xs mt-1 font-mono truncate">
                {wallet.address.slice(0, 10)}…
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <p className="text-muted-foreground font-medium mt-2 text-sm">Nicht verifiziert</p>
              <Link
                href="/satoshi-test"
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                Jetzt verifizieren →
              </Link>
            </div>
          )}
        </motion.div>

        {/* Wallet Address */}
        {isConnected && address && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className={`${card} col-span-12 md:col-span-4`}
          >
            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>Verbundene Wallet</span>
            </div>
            <p className="font-mono text-xs text-foreground break-all">{address}</p>
            <p className="text-xs text-muted-foreground mt-2">Sepolia Testnet</p>
          </motion.div>
        )}

        {/* Holdings placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`${card} col-span-12 ${isConnected && address ? "md:col-span-8" : "md:col-span-6"}`}
        >
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Coins className="w-4 h-4" />
            <span>Bestände</span>
          </div>
          <div className="space-y-3">
            {[
              { symbol: "ETH", name: "Sepolia ETH", amount: ethFormatted ? parseFloat(ethFormatted).toFixed(4) : "—", badge: "Live" },
              { symbol: "USDC", name: "USD Coin", amount: "—", badge: "Testnet" },
              { symbol: "stETH", name: "Staked ETH", amount: "—", badge: "Mock" },
            ].map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {asset.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
                    <p className="text-xs text-muted-foreground">{asset.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{asset.amount}</p>
                  <span className="text-xs text-muted-foreground">{asset.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${card} col-span-12 md:col-span-6`}
        >
          <p className="text-sm text-muted-foreground mb-4">Letzte Transaktionen</p>
          {loading ? (
            <p className="text-xs text-muted-foreground">Lädt…</p>
          ) : transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.direction === "in" ? "bg-success/10" : "bg-destructive/10"
                    }`}>
                      {tx.direction === "in"
                        ? <ArrowDownLeft className="w-4 h-4 text-success" />
                        : <ArrowUpRight className="w-4 h-4 text-destructive" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {tx.direction === "in" ? "Empfangen" : "Gesendet"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {tx.tx_hash ? tx.tx_hash.slice(0, 12) + "…" : "pending"}
                      </p>
                    </div>
                  </div>
                  <p className={`text-sm font-medium ${tx.direction === "in" ? "text-success" : "text-destructive"}`}>
                    {tx.direction === "in" ? "+" : "-"}{tx.amount} {tx.token}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-xs text-muted-foreground">Noch keine Transaktionen.</p>
              <Link href="/send" className="text-xs text-primary hover:underline mt-1 inline-block">
                Erste Transaktion senden →
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
