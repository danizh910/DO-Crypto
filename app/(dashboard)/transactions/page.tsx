"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownLeft, ExternalLink, Receipt, Search, Filter, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAccount } from "wagmi";
import type { Transaction } from "@/lib/supabase/types";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "text-success bg-success/10 border-success/20",
  pending:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  failed:    "text-destructive bg-destructive/10 border-destructive/20",
};

export default function TransactionsPage() {
  const { address, isConnected } = useAccount();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [search, setSearch]             = useState("");
  const [filter, setFilter]             = useState<"all" | "in" | "out">("all");

  const loadTransactions = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setTransactions(data ?? []);
    setLoading(false);
  }, []);

  const syncAndReload = useCallback(async () => {
    if (!address || syncing) return;
    setSyncing(true);
    try {
      await fetch("/api/transactions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
    } catch { /* silent */ }
    await loadTransactions();
    setSyncing(false);
  }, [address, syncing, loadTransactions]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  // Auto-sync once when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      syncAndReload();
    }
  }, [isConnected, address, syncAndReload]);

  const filtered = transactions.filter((tx) => {
    const matchesFilter = filter === "all" || tx.direction === filter;
    const matchesSearch =
      !search ||
      tx.tx_hash?.toLowerCase().includes(search.toLowerCase()) ||
      tx.token?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalSent     = transactions.filter((t) => t.direction === "out").reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0);
  const totalReceived = transactions.filter((t) => t.direction === "in").reduce((s, t) => s + parseFloat(t.amount ?? "0"), 0);

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Transaktionen</h1>
          </div>
          {isConnected && (
            <button
              onClick={syncAndReload}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronisiert…" : "Sync"}
            </button>
          )}
        </div>
        <p className="text-muted-foreground text-sm">Alle deine On-Chain Aktivitäten auf dem Sepolia Testnet.</p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: "Gesamt", value: transactions.length.toString(), sub: "Transaktionen" },
          { label: "Gesendet", value: totalSent.toFixed(4), sub: "ETH" },
          { label: "Empfangen", value: totalReceived.toFixed(4), sub: "ETH" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="glass rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-semibold text-foreground mt-0.5">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div
        className="flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="text"
            placeholder="Hash oder Token suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground ml-1" />
          {(["all", "out", "in"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                filter === f ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Alle" : f === "out" ? "Gesendet" : "Empfangen"}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Transaction List */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {loading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Lädt…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 flex flex-col items-center gap-3 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              {transactions.length === 0 ? "Noch keine Transaktionen." : "Keine Transaktionen gefunden."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors"
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  tx.direction === "in" ? "bg-success/10" : "bg-destructive/10"
                }`}>
                  {tx.direction === "in"
                    ? <ArrowDownLeft className="w-4 h-4 text-success" />
                    : <ArrowUpRight className="w-4 h-4 text-destructive" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {tx.direction === "in" ? "Empfangen" : "Gesendet"}
                    </p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[tx.status ?? "confirmed"] ?? STATUS_COLORS.confirmed}`}>
                      {tx.status === "confirmed" ? "Bestätigt" : tx.status === "pending" ? "Ausstehend" : "Fehlgeschlagen"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {tx.tx_hash ? tx.tx_hash.slice(0, 20) + "…" : "—"}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-semibold ${tx.direction === "in" ? "text-success" : "text-destructive"}`}>
                    {tx.direction === "in" ? "+" : "-"}{parseFloat(tx.amount ?? "0").toFixed(6)} {tx.token ?? "ETH"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                </div>

                {tx.tx_hash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${tx.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
