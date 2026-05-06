"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import {
  ShoppingCart, CheckCircle2, Loader2, Info,
  AlertCircle, RefreshCw, TrendingUp, TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const TOKENS = [
  { id: "ethereum",  symbol: "ETH",  name: "Ethereum",  logo: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",         fallback: "Ξ"  },
  { id: "bitcoin",   symbol: "BTC",  name: "Bitcoin",   logo: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png",            fallback: "₿"  },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", logo: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png", fallback: "⬡" },
  { id: "uniswap",   symbol: "UNI",  name: "Uniswap",   logo: "https://assets.coingecko.com/coins/images/12504/small/uni.jpg",            fallback: "🦄" },
];

const FIAT = ["CHF", "EUR", "USD"];

interface PriceData {
  [key: string]: { chf: number; eur: number; usd: number; chf_24h_change: number };
}

export default function BuyPage() {
  const { isConnected } = useAccount();

  const [selectedToken, setSelectedToken] = useState("ethereum");
  const [fiatCurrency, setFiatCurrency]   = useState("CHF");
  const [fiatAmount, setFiatAmount]       = useState("");
  const [prices, setPrices]               = useState<PriceData>({});
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [buying, setBuying]               = useState(false);
  const [done, setDone]                   = useState(false);
  const [error, setError]                 = useState("");
  const [lastResult, setLastResult]       = useState<{ symbol: string; amount: string; fiat: string } | null>(null);

  const fetchPrices = useCallback(async () => {
    setLoadingPrices(true);
    try {
      const ids = TOKENS.map(t => t.id).join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=chf,eur,usd&include_24hr_change=true`,
        { next: { revalidate: 60 } }
      );
      if (res.ok) {
        const data = await res.json();
        // Normalise keys
        const normalised: PriceData = {};
        for (const [id, vals] of Object.entries(data as Record<string, Record<string, number>>)) {
          normalised[id] = {
            chf: vals.chf ?? 0,
            eur: vals.eur ?? 0,
            usd: vals.usd ?? 0,
            chf_24h_change: vals.chf_24h_change ?? 0,
          };
        }
        setPrices(normalised);
      }
    } catch { /* silent */ }
    setLoadingPrices(false);
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const tokenInfo = TOKENS.find(t => t.id === selectedToken)!;
  const priceData = prices[selectedToken];
  const unitPrice = priceData?.[fiatCurrency.toLowerCase() as "chf" | "eur" | "usd"] ?? 0;
  const parsedFiat = parseFloat(fiatAmount);
  const cryptoAmount = unitPrice > 0 && !isNaN(parsedFiat) ? (parsedFiat / unitPrice).toFixed(8) : "";

  useEffect(() => { setDone(false); }, [selectedToken, fiatAmount, fiatCurrency]);

  async function handleBuy() {
    setError("");
    if (!fiatAmount || isNaN(parsedFiat) || parsedFiat <= 0) { setError("Betrag eingeben"); return; }
    if (parsedFiat < 10) { setError("Mindestbetrag: 10 " + fiatCurrency); return; }
    if (!isConnected) { setError("Wallet verbinden"); return; }
    if (unitPrice <= 0) { setError("Kurs nicht verfügbar"); return; }

    setBuying(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Nicht eingeloggt"); setBuying(false); return; }

      const crypto = parseFloat(cryptoAmount);
      const { error: dbErr } = await supabase.from("purchase_transactions").insert({
        user_id:      user.id,
        token:        tokenInfo.symbol,
        fiat_amount:  parsedFiat,
        fiat_currency: fiatCurrency,
        crypto_amount: crypto,
        rate_at_buy:  unitPrice,
        status:       "confirmed",
      });

      if (dbErr) { setError("DB-Fehler: " + dbErr.message); setBuying(false); return; }

      // Also record in transactions for portfolio view
      await supabase.from("transactions").insert({
        user_id:   user.id,
        amount:    crypto.toFixed(8),
        token:     tokenInfo.symbol,
        chain_id:  11155111,
        direction: "in",
        status:    "confirmed",
      });

      setLastResult({ symbol: tokenInfo.symbol, amount: cryptoAmount, fiat: `${fiatAmount} ${fiatCurrency}` });
      setDone(true);
      setFiatAmount("");
    } catch {
      setError("Netzwerkfehler");
    }
    setBuying(false);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10 border border-success/20">
              <ShoppingCart className="w-5 h-5 text-success" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Krypto kaufen</h1>
          </div>
          <button
            onClick={fetchPrices}
            disabled={loadingPrices}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? "animate-spin" : ""}`} />
            Live-Kurse
          </button>
        </div>
        <p className="text-muted-foreground text-sm">
          Kaufe Krypto-Assets zu Live-Marktpreisen (simuliert, Testnet).
        </p>
      </motion.div>

      {/* Token selector with live prices */}
      <motion.div
        className="grid grid-cols-2 gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {TOKENS.map((token) => {
          const p = prices[token.id];
          const chfPrice = p?.chf ?? 0;
          const selected = selectedToken === token.id;
          return (
            <button
              key={token.id}
              onClick={() => { setSelectedToken(token.id); setError(""); }}
              className={`glass rounded-xl p-3 text-left transition-all ${
                selected ? "border-primary/50 bg-primary/5" : "border-white/5 hover:border-white/15"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <img
                    src={token.logo}
                    alt={token.symbol}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                      const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                      if (next) next.style.display = "inline";
                    }}
                  />
                  <span className="hidden text-lg">{token.fallback}</span>
                  <span className="text-sm font-semibold text-foreground">{token.symbol}</span>
                </div>
                {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
              </div>
              {loadingPrices ? (
                <div className="h-4 w-16 bg-white/5 rounded animate-pulse" />
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-foreground">
                    {chfPrice > 0 ? `CHF ${chfPrice.toLocaleString("de-CH", { maximumFractionDigits: 2 })}` : "—"}
                  </span>
                  {p?.chf_24h_change != null && p.chf_24h_change !== 0 && (
                    <span className={`text-xs flex items-center gap-0.5 ${p.chf_24h_change >= 0 ? "text-success" : "text-destructive"}`}>
                      {p.chf_24h_change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(p.chf_24h_change).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </motion.div>

      <AnimatePresence mode="wait">
        {done && lastResult ? (
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
              <h2 className="text-xl font-bold text-success">Kauf erfolgreich</h2>
              <p className="text-muted-foreground text-sm mt-1">
                <strong className="text-foreground">{lastResult.amount} {lastResult.symbol}</strong> für {lastResult.fiat} gekauft.
              </p>
            </div>
            <button
              onClick={() => { setDone(false); setLastResult(null); }}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Weiterer Kauf
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 space-y-5"
          >
            {!isConnected && (
              <div className="bg-secondary/10 border border-secondary/20 rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                Verbinde deine Wallet um zu kaufen.
              </div>
            )}

            {/* Fiat amount */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Du zahlst</label>
              <div className="flex gap-2">
                <select
                  value={fiatCurrency}
                  onChange={(e) => setFiatCurrency(e.target.value)}
                  className="w-24 bg-card border border-border rounded-xl px-3 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 appearance-none"
                >
                  {FIAT.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input
                  type="number"
                  min="10"
                  step="10"
                  placeholder="100"
                  value={fiatAmount}
                  onChange={(e) => { setFiatAmount(e.target.value); setError(""); }}
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {[50, 100, 250, 500].map((v) => (
                  <button
                    key={v}
                    onClick={() => setFiatAmount(String(v))}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                      fiatAmount === String(v) ? "bg-primary/20 text-primary" : "glass text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {fiatCurrency} {v}
                  </button>
                ))}
              </div>
            </div>

            {/* You receive */}
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-medium">Du erhältst (ungefähr)</label>
              <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className={cryptoAmount ? "text-foreground font-semibold" : "text-muted-foreground text-sm"}>
                  {cryptoAmount || "—"} {tokenInfo.symbol}
                </span>
                {unitPrice > 0 && (
                  <span className="text-xs text-muted-foreground">
                    @ {fiatCurrency} {unitPrice.toLocaleString("de-CH", { maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
            </div>

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
              onClick={handleBuy}
              disabled={!isConnected || buying || !fiatAmount || unitPrice <= 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-success text-background font-semibold rounded-xl text-sm hover:bg-success/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {buying
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Kaufe…</>
                : <><ShoppingCart className="w-4 h-4" /> {tokenInfo.symbol} kaufen</>
              }
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Simulierter Kauf auf dem Testnet. Kein echtes Kapital.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
