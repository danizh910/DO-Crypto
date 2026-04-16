"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useBalance } from "wagmi";
import { formatUnits } from "viem";
import {
  TrendingUp, Zap, Lock, CheckCircle2, Loader2, Info,
  ArrowDownLeft, Clock, Unlock, Coins,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sepolia } from "wagmi/chains";
import type { StakingPosition } from "@/lib/supabase/types";

const PROTOCOLS = [
  {
    id: "lido",
    name: "Lido",
    token: "stETH",
    apy: 3.8,
    tvl: "$32.4B",
    risk: "Low",
    description: "Liquid staking für ETH. Du erhältst stETH das täglich Rewards akkumuliert.",
    color: "primary",
  },
  {
    id: "aave",
    name: "Aave v3",
    token: "aETH",
    apy: 2.1,
    tvl: "$11.2B",
    risk: "Low",
    description: "Dezentrales Lending-Protokoll. ETH als Sicherheit hinterlegen und Zinsen verdienen.",
    color: "secondary",
  },
  {
    id: "rocketpool",
    name: "Rocket Pool",
    token: "rETH",
    apy: 3.5,
    tvl: "$4.1B",
    risk: "Low",
    description: "Dezentrales ETH-Staking Protokoll. Dezentraler als Lido.",
    color: "success",
  },
  {
    id: "eigenlayer",
    name: "EigenLayer",
    token: "restETH",
    apy: 6.2,
    tvl: "$18.7B",
    risk: "Medium",
    description: "Restaking-Protokoll. Höhere Rendite durch zusätzliche Validierungsaufgaben.",
    color: "primary",
  },
];

const riskColor: Record<string, string> = {
  Low:    "text-success bg-success/10 border-success/20",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  High:   "text-destructive bg-destructive/10 border-destructive/20",
};

function calcRewards(position: StakingPosition): number {
  const started = new Date(position.started_at ?? position.id).getTime();
  const days = (Date.now() - started) / (1000 * 60 * 60 * 24);
  return parseFloat(position.amount) * (position.apy_at_stake / 100) * (days / 365);
}

function formatDuration(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return "Heute gestartet";
  if (days === 1) return "1 Tag";
  return `${days} Tage`;
}

export default function StakingPage() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });

  const [positions, setPositions] = useState<StakingPosition[]>([]);
  const [loading, setLoading]     = useState(true);
  const [staking, setStaking]     = useState<string | null>(null);
  const [unstaking, setUnstaking] = useState<string | null>(null);
  const [amounts, setAmounts]     = useState<Record<string, string>>({});
  const [error, setError]         = useState<string | null>(null);
  const [justStaked, setJustStaked] = useState<string | null>(null);
  const [justUnstaked, setJustUnstaked] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("staking_positions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false });
    setPositions(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPositions(); }, [loadPositions]);

  const totalStakedETH = useMemo(
    () => positions.reduce((sum, p) => sum + parseFloat(p.amount), 0),
    [positions]
  );

  const ethBalance  = balance ? parseFloat(formatUnits(balance.value, balance.decimals)) : 0;
  // Available = on-chain balance minus what's already virtually staked
  const availableETH = Math.max(0, ethBalance - totalStakedETH);

  async function handleStake(protocolId: string, protocolName: string, apy: number, token: string) {
    const amount = amounts[protocolId];
    const parsed = parseFloat(amount);

    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError("Bitte einen gültigen Betrag eingeben.");
      return;
    }
    if (!isConnected) {
      setError("Wallet verbinden um zu staken.");
      return;
    }
    if (parsed > availableETH) {
      setError(
        `Nicht genug ETH verfügbar. Verfügbar: ${availableETH.toFixed(6)} ETH` +
        (totalStakedETH > 0 ? ` (${ethBalance.toFixed(4)} ETH gesamt − ${totalStakedETH.toFixed(4)} ETH bereits gestaked)` : "")
      );
      return;
    }
    if (parsed < 0.001) {
      setError("Mindestbetrag: 0.001 ETH");
      return;
    }

    setStaking(protocolId);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStaking(null); return; }

    const { error: dbErr } = await supabase.from("staking_positions").insert({
      user_id: user.id,
      protocol: protocolName,
      token,
      amount: parsed.toFixed(8),
      apy_at_stake: apy,
      status: "active",
      started_at: new Date().toISOString(),
    });

    if (dbErr) {
      setError("DB-Fehler: " + dbErr.message);
    } else {
      setAmounts((prev) => ({ ...prev, [protocolId]: "" }));
      setJustStaked(protocolId);
      await loadPositions();
      setTimeout(() => setJustStaked(null), 3000);
    }
    setStaking(null);
  }

  async function handleUnstake(position: StakingPosition) {
    setUnstaking(position.id);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUnstaking(null); return; }

    const rewards     = calcRewards(position);
    const totalReturn = parseFloat(position.amount) + rewards;

    // Mark as unstaked
    const { error: updateErr } = await supabase
      .from("staking_positions")
      .update({ status: "unstaked" })
      .eq("id", position.id)
      .eq("user_id", user.id);

    if (updateErr) {
      setError("Fehler beim Entstaken: " + updateErr.message);
      setUnstaking(null);
      return;
    }

    // Record the return as an incoming transaction
    await supabase.from("transactions").insert({
      user_id: user.id,
      amount: totalReturn.toFixed(8),
      token: "ETH",
      chain_id: 11155111,
      direction: "in",
      status: "confirmed",
    });

    setJustUnstaked(position.id);
    await loadPositions();
    setTimeout(() => setJustUnstaked(null), 3000);
    setUnstaking(null);
  }

  const totalRewards = positions.reduce((sum, p) => sum + calcRewards(p), 0);

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
            <TrendingUp className="w-5 h-5 text-secondary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Staking</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Simuliertes DeFi-Staking auf dem Sepolia Testnet. Kein echtes Kapital.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: "Verfügbar",    value: isConnected ? `${availableETH.toFixed(4)} ETH` : "—",          icon: Coins },
          { label: "Gestaked",     value: `${totalStakedETH.toFixed(4)} ETH`,                             icon: Lock },
          { label: "Ø Rewards",    value: positions.length ? `+${totalRewards.toFixed(6)} ETH` : "—",    icon: TrendingUp },
          { label: "Positionen",   value: positions.length.toString(),                                    icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base font-semibold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive"
        >
          {error}
        </motion.div>
      )}

      {!isConnected && (
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground border border-white/5">
          <Info className="w-4 h-4 flex-shrink-0" />
          Verbinde deine Wallet um zu staken. Dein ETH-Guthaben wird als Limit verwendet.
        </div>
      )}

      {/* Active positions */}
      <AnimatePresence>
        {!loading && positions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="w-4 h-4 text-secondary" />
              Meine aktiven Positionen
            </h2>
            {positions.map((pos) => {
              const rewards     = calcRewards(pos);
              const totalReturn = parseFloat(pos.amount) + rewards;
              const protocol    = PROTOCOLS.find((p) => p.name === pos.protocol);

              return (
                <motion.div
                  key={pos.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="glass rounded-2xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                        protocol ? `bg-${protocol.color}/10 border border-${protocol.color}/20 text-${protocol.color}` : "bg-secondary/10 border border-secondary/20 text-secondary"
                      }`}>
                        {pos.protocol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{pos.protocol}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDuration(pos.started_at)}</span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-success">{pos.apy_at_stake}% APY</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-foreground">
                        {parseFloat(pos.amount).toFixed(6)} ETH
                      </p>
                      <p className="text-xs text-muted-foreground">gestaked</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Rewards bisher</p>
                        <p className="text-sm font-medium text-success">+{rewards.toFixed(8)} ETH</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Rückgabe gesamt</p>
                        <p className="text-sm font-medium text-foreground">{totalReturn.toFixed(6)} ETH</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Erhalten als</p>
                        <p className="text-sm font-medium text-foreground">{pos.token}</p>
                      </div>
                    </div>

                    <AnimatePresence mode="wait">
                      {justUnstaked === pos.id ? (
                        <motion.div
                          key="done"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex items-center gap-1.5 text-success text-sm font-medium"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Entstaked
                        </motion.div>
                      ) : (
                        <motion.button
                          key="btn"
                          onClick={() => handleUnstake(pos)}
                          disabled={unstaking === pos.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm font-medium hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                        >
                          {unstaking === pos.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Unlock className="w-3.5 h-3.5" />
                          }
                          Entstaken
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Reward progress bar — visual only */}
                  <div className="mt-3">
                    <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-secondary to-success transition-all"
                        style={{ width: `${Math.min(100, (rewards / parseFloat(pos.amount)) * 100 * 10)}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Protocol cards */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-secondary" />
          Protokolle
        </h2>

        {PROTOCOLS.map((p, i) => {
          const alreadyStaked = positions.filter((pos) => pos.protocol === p.name);

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="glass rounded-2xl p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold bg-${p.color}/10 border border-${p.color}/20 text-${p.color}`}>
                    {p.name.slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${riskColor[p.risk]}`}>
                        {p.risk} Risk
                      </span>
                      {alreadyStaked.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-secondary">
                          Aktiv
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-success">{p.apy}%</p>
                  <p className="text-xs text-muted-foreground">APY</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                {/* Info row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>TVL: {p.tvl}</span>
                  <span>·</span>
                  <span>Du erhältst: <strong className="text-foreground">{p.token}</strong></span>
                  <span>·</span>
                  <span>
                    Verfügbar:{" "}
                    <strong className={availableETH <= 0 && isConnected ? "text-destructive" : "text-foreground"}>
                      {isConnected ? `${availableETH.toFixed(4)} ETH` : "—"}
                    </strong>
                  </span>
                </div>

                {/* Input + button */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Betrag in ETH"
                      value={amounts[p.id] ?? ""}
                      onChange={(e) => {
                        setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }));
                        setError(null);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                    />
                    {isConnected && availableETH > 0 && (
                      <button
                        type="button"
                        onClick={() => setAmounts((prev) => ({ ...prev, [p.id]: availableETH.toFixed(6) }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-primary hover:text-primary/80 transition-colors"
                      >
                        Max
                      </button>
                    )}
                  </div>

                  <AnimatePresence mode="wait">
                    {justStaked === p.id ? (
                      <motion.div
                        key="done"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1.5 text-success text-sm font-medium whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Gestaked!
                      </motion.div>
                    ) : (
                      <motion.button
                        key="btn"
                        onClick={() => handleStake(p.id, p.name, p.apy, p.token)}
                        disabled={!isConnected || staking === p.id || availableETH <= 0}
                        className="flex items-center gap-1.5 px-4 py-2 bg-secondary/20 border border-secondary/30 text-secondary rounded-lg text-sm font-medium hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                      >
                        {staking === p.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <ArrowDownLeft className="w-3.5 h-3.5" />
                        }
                        Staken
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>

                {/* Preview */}
                {amounts[p.id] && parseFloat(amounts[p.id]) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-xs text-muted-foreground bg-white/3 rounded-lg px-3 py-2 flex items-center justify-between"
                  >
                    <span>Du stakest: <strong className="text-foreground">{amounts[p.id]} ETH</strong></span>
                    <span>Jährliche Rewards: <strong className="text-success">+{(parseFloat(amounts[p.id]) * p.apy / 100).toFixed(6)} ETH</strong></span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </section>

      <div className="flex items-center gap-2 text-xs text-muted-foreground pb-4">
        <Info className="w-3 h-3" />
        Alle APY-Werte sind Simulationen auf dem Testnet. Kein echtes Kapital wird bewegt.
      </div>
    </div>
  );
}
