"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useSendTransaction, useBalance, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, isAddress, formatUnits } from "viem";
import { Send, CheckCircle2, AlertCircle, Loader2, ExternalLink, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sepolia } from "wagmi/chains";

export default function SendPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedTx, setSavedTx] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendTransaction, data: txHash, isPending, reset } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  async function saveTxToSupabase(hash: string) {
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    await supabase.from("transactions").insert({
      user_id: user.id,
      tx_hash: hash,
      amount,
      token: "ETH",
      chain_id: sepolia.id,
      direction: "out",
      status: "confirmed",
    });
    setSaving(false);
    setSavedTx(true);
  }

  // Save tx once confirmed
  if (isConfirmed && txHash && !savedTx && !saving) {
    saveTxToSupabase(txHash);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isAddress(to)) {
      setError("Ungültige Empfängeradresse.");
      return;
    }
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Ungültiger Betrag.");
      return;
    }
    if (balance && parseFloat(amount) > parseFloat(formatUnits(balance.value, balance.decimals))) {
      setError("Guthaben nicht ausreichend.");
      return;
    }

    sendTransaction({
      to: to as `0x${string}`,
      value: parseEther(amount),
      chainId: sepolia.id,
    });
  }

  function handleReset() {
    reset();
    setTo("");
    setAmount("");
    setError(null);
    setSavedTx(false);
  }

  const sepoliaExplorer = "https://sepolia.etherscan.io/tx/";

  return (
    <div className="max-w-lg space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Send className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Senden</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Sende Sepolia ETH an eine beliebige Adresse.
        </p>
      </motion.div>

      {/* Balance */}
      {isConnected && address && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <span className="font-mono text-xs truncate max-w-[180px]">{address}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {balance ? `${parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4)} ETH` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">Sepolia</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {/* Success state */}
        {isConfirmed ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 flex flex-col items-center text-center gap-5"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="w-16 h-16 rounded-full bg-success/15 border-2 border-success flex items-center justify-center"
            >
              <CheckCircle2 className="w-8 h-8 text-success" />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-success mb-1">Transaktion bestätigt</h2>
              <p className="text-muted-foreground text-sm">
                {amount} ETH wurde erfolgreich gesendet.
              </p>
            </div>
            {txHash && (
              <a
                href={`${sepoliaExplorer}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Auf Etherscan ansehen
              </a>
            )}
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Neue Transaktion
            </button>
          </motion.div>
        ) : (
          /* Send form */
          <motion.form
            key="form"
            onSubmit={handleSend}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl p-6 space-y-5"
          >
            {!isConnected && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3 text-sm text-muted-foreground">
                Verbinde zuerst deine Wallet (oben in der Sidebar).
              </div>
            )}

            {/* Recipient */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Empfängeradresse
              </label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="0x..."
                disabled={!isConnected || isPending || isConfirming}
                className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 transition-colors"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">
                Betrag (ETH)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.001"
                  min="0"
                  step="0.0001"
                  disabled={!isConnected || isPending || isConfirming}
                  className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => balance && setAmount(parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(6))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  Max
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Confirming status */}
            {isConfirming && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white/3 rounded-xl px-3 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Warte auf Bestätigung…
              </div>
            )}

            {/* Tx hash preview */}
            {txHash && !isConfirmed && (
              <div className="text-xs text-muted-foreground bg-white/3 rounded-xl px-3 py-2">
                TX: <span className="font-mono">{txHash.slice(0, 20)}…</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!isConnected || isPending || isConfirming}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl text-sm hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isPending || isConfirming ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {isPending ? "Bestätigen in Wallet…" : "Warte auf Chain…"}</>
              ) : (
                <><Send className="w-4 h-4" /> Senden</>
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
