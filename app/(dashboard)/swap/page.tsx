"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { ArrowUpDown, CheckCircle2, Loader2, Info, AlertCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sepolia } from "wagmi/chains";

const TOKENS = [
  { id: "ETH",    name: "Ethereum",    symbol: "ETH",    color: "primary" },
  { id: "stETH",  name: "Lido stETH",  symbol: "stETH",  color: "primary" },
  { id: "rETH",   name: "Rocket Pool", symbol: "rETH",   color: "success" },
  { id: "USDC",   name: "USD Coin",    symbol: "USDC",   color: "secondary" },
];

// Simulated rates relative to ETH
const RATES: Record<string, number> = {
  "ETH/stETH":  0.9996, // 1 ETH ≈ 0.9996 stETH
  "ETH/rETH":   0.9251, // 1 ETH ≈ 0.9251 rETH
  "ETH/USDC":   3247.80,
  "stETH/ETH":  1.0004,
  "stETH/rETH": 0.9255,
  "stETH/USDC": 3249.10,
  "rETH/ETH":   1.0809,
  "rETH/stETH": 1.0807,
  "rETH/USDC":  3511.40,
  "USDC/ETH":   0.000308,
  "USDC/stETH": 0.000308,
  "USDC/rETH":  0.000285,
};

function getRate(from: string, to: string): number {
  if (from === to) return 1;
  return RATES[`${from}/${to}`] ?? 1;
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });

  const [fromToken, setFromToken] = useState("ETH");
  const [toToken, setToToken]     = useState("stETH");
  const [amount, setAmount]       = useState("");
  const [swapping, setSwapping]   = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");
  const [swapResult, setSwapResult] = useState<{ from: string; to: string; received: string } | null>(null);

  const ethBalance = balance ? parseFloat(formatUnits(balance.value, balance.decimals)) : 0;
  const rate       = getRate(fromToken, toToken);
  const parsed     = parseFloat(amount);
  const toAmount   = !isNaN(parsed) && parsed > 0 ? (parsed * rate).toFixed(6) : "";

  // Reset done state when inputs change
  useEffect(() => { setDone(false); setSwapResult(null); }, [fromToken, toToken, amount]);

  function flip() {
    const prev = fromToken;
    setFromToken(toToken);
    setToToken(prev);
    setAmount(toAmount);
    setError("");
  }

  async function handleSwap() {
    setError("");
    if (!amount || isNaN(parsed) || parsed <= 0) { setError("Betrag eingeben"); return; }
    if (!isConnected) { setError("Wallet verbinden"); return; }
    if (fromToken === "ETH" && parsed > ethBalance) {
      setError(`Nicht genug ETH. Verfügbar: ${ethBalance.toFixed(4)}`); return;
    }
    if (parsed < 0.0001) { setError("Mindestbetrag: 0.0001"); return; }

    setSwapping(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Nicht eingeloggt"); setSwapping(false); return; }

      const received = (parsed * rate).toFixed(8);

      const { error: dbErr } = await supabase.from("swap_transactions").insert({
        user_id:     user.id,
        from_token:  fromToken,
        to_token:    toToken,
        from_amount: parsed,
        to_amount:   parseFloat(received),
        rate,
        status:      "confirmed",
      });

      if (dbErr) { setError("DB-Fehler: " + dbErr.message); setSwapping(false); return; }

      setSwapResult({ from: `${amount} ${fromToken}`, to: toToken, received });
      setDone(true);
      setAmount("");
    } catch {
      setError("Netzwerkfehler");
    }
    setSwapping(false);
  }

  const fromInfo = TOKENS.find(t => t.id === fromToken)!;
  const toInfo   = TOKENS.find(t => t.id === toToken)!;

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
            <ArrowUpDown className="w-5 h-5 text-secondary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Swap</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Tausche Krypto-Assets auf dem Sepolia Testnet (simuliert).
        </p>
      </motion.div>

      {/* Rate ticker */}
      <motion.div
        className="flex gap-3 overflow-x-auto pb-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { pair: "ETH/USDC", rate: "3,247.80" },
          { pair: "ETH/stETH", rate: "0.9996" },
          { pair: "ETH/rETH", rate: "0.9251" },
          { pair: "rETH/USDC", rate: "3,511.40" },
        ].map(({ pair, rate: r }) => (
          <div key={pair} className="glass rounded-lg px-3 py-1.5 text-xs whitespace-nowrap flex items-center gap-1.5 shrink-0">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-muted-foreground">{pair}</span>
            <span className="text-foreground font-medium">{r}</span>
          </div>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {done && swapResult ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl p-8 flex flex-col items-center gap-5 text-center"
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
              <h2 className="text-xl font-bold text-success">Swap erfolgreich</h2>
              <p className="text-muted-foreground text-sm mt-1">
                {swapResult.from} → <strong className="text-foreground">{swapResult.received} {swapResult.to}</strong>
              </p>
            </div>
            <button
              onClick={() => { setDone(false); setSwapResult(null); }}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Neuer Swap
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 space-y-4"
          >
            {!isConnected && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                Verbinde deine Wallet für Swaps.
              </div>
            )}

            {/* From */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Von</label>
              <div className="flex gap-2">
                <select
                  value={fromToken}
                  onChange={(e) => { setFromToken(e.target.value); setError(""); }}
                  className="w-32 bg-card border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
                >
                  {TOKENS.map(t => (
                    <option key={t.id} value={t.id} disabled={t.id === toToken}>{t.symbol}</option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(""); }}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  {fromToken === "ETH" && isConnected && (
                    <button
                      type="button"
                      onClick={() => setAmount(ethBalance.toFixed(6))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>
              {fromToken === "ETH" && isConnected && (
                <p className="text-xs text-muted-foreground">
                  Guthaben: {ethBalance.toFixed(4)} ETH
                </p>
              )}
            </div>

            {/* Flip button */}
            <div className="flex justify-center">
              <button
                onClick={flip}
                className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>
            </div>

            {/* To */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Zu</label>
              <div className="flex gap-2">
                <select
                  value={toToken}
                  onChange={(e) => { setToToken(e.target.value); setError(""); }}
                  className="w-32 bg-card border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
                >
                  {TOKENS.map(t => (
                    <option key={t.id} value={t.id} disabled={t.id === fromToken}>{t.symbol}</option>
                  ))}
                </select>
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm">
                  <span className={toAmount ? "text-foreground font-medium" : "text-muted-foreground"}>
                    {toAmount || "0.00"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rate info */}
            {fromToken !== toToken && (
              <div className="bg-white/3 rounded-xl px-3 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Kurs</span>
                <span>1 {fromInfo.symbol} = {rate.toLocaleString("de-CH", { maximumFractionDigits: 6 })} {toInfo.symbol}</span>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5 text-sm text-destructive"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}

            <button
              onClick={handleSwap}
              disabled={!isConnected || swapping || !amount || fromToken === toToken}
              className="w-full flex items-center justify-center gap-2 py-3 bg-secondary text-background font-semibold rounded-xl text-sm hover:bg-secondary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {swapping
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Swapping…</>
                : <><ArrowUpDown className="w-4 h-4" /> Swap ausführen</>
              }
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Simulierter Swap — kein echtes Kapital. Kurse sind Näherungswerte.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
