"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { QrCode, Copy, CheckCircle2, Wallet, AlertCircle, RefreshCw, ArrowDownLeft } from "lucide-react";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function ReceivePage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied]         = useState(false);
  const [syncing, setSyncing]       = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; total: number } | null>(null);
  const [syncError, setSyncError]   = useState("");
  const [hasSynced, setHasSynced]   = useState(false);

  function copy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Use a ref for the "in-flight" guard so it never appears in deps
  const isSyncingRef = useRef(false);

  const syncTransactions = useCallback(async () => {
    if (!address || isSyncingRef.current) return;
    isSyncingRef.current = true;
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    // Mark as synced immediately so the auto-sync effect never retries
    setHasSynced(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("/api/transactions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Fehler beim Synchronisieren");
      } else {
        setSyncResult({ added: data.added, total: data.total ?? 0 });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setSyncError("Timeout — Alchemy antwortet nicht");
      } else {
        setSyncError("Netzwerkfehler");
      }
    } finally {
      isSyncingRef.current = false;
      setSyncing(false);
    }
  }, [address]); // isSyncingRef is stable (useRef), intentionally omitted

  // Auto-sync once when wallet connects
  useEffect(() => {
    if (isConnected && address && !hasSynced) {
      syncTransactions();
    }
  }, [isConnected, address, hasSynced, syncTransactions]);

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Empfangen</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Teile deine Wallet-Adresse um Sepolia ETH zu empfangen.
        </p>
      </motion.div>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Keine Wallet verbunden</p>
            <p className="text-muted-foreground text-sm mt-1">
              Verbinde eine Wallet um deine Empfangsadresse zu sehen.
            </p>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-8 flex flex-col items-center gap-6"
          >
            {/* QR Code */}
            <div className="p-4 bg-white rounded-2xl shadow-lg">
              <QRCode
                value={address ?? ""}
                size={200}
                bgColor="#ffffff"
                fgColor="#020617"
                level="M"
              />
            </div>

            {/* Network badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-primary text-xs font-medium">Sepolia Testnet</span>
            </div>

            {/* Address */}
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground text-center font-medium">Wallet-Adresse</p>
              <div
                onClick={copy}
                className="cursor-pointer flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors group"
              >
                <Wallet className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <code className="flex-1 text-xs font-mono text-foreground break-all">{address}</code>
                <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-success" />
                    : <Copy className="w-4 h-4" />
                  }
                </div>
              </div>
              <AnimatePresence>
                {copied && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xs text-success"
                  >
                    Adresse kopiert!
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Nur Sepolia Testnet ETH senden — kein echtes Kapital.
            </p>
          </motion.div>

          {/* Sync panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-success" />
                <span className="text-sm font-medium text-foreground">Eingehende Transaktionen</span>
              </div>
              <button
                onClick={syncTransactions}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Scannt…" : "Neu scannen"}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {syncing && (
                <motion.div
                  key="scanning"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                  Scanne Blockchain nach eingehenden Transfers…
                </motion.div>
              )}

              {!syncing && syncResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  {syncResult.added > 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      <p className="text-sm text-success font-medium">
                        {syncResult.added} neue Transaktion{syncResult.added !== 1 ? "en" : ""} gefunden und gespeichert!
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <p className="text-sm text-muted-foreground">
                        Keine neuen Transaktionen. {syncResult.total > 0 ? `${syncResult.total} On-Chain TX bereits erfasst.` : "Noch keine eingehenden TX auf dieser Adresse."}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground text-right">
                    <Link href="/transactions" className="hover:text-primary transition-colors">
                      Alle Transaktionen ansehen →
                    </Link>
                  </p>
                </motion.div>
              )}

              {!syncing && syncError && (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20"
                >
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">{syncError}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      <div className="text-center">
        <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Zurück zum Portfolio
        </Link>
      </div>
    </div>
  );
}
