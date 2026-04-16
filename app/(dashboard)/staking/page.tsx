"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { TrendingUp, Zap, Lock, CheckCircle2, Loader2, ExternalLink, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  Low: "text-success bg-success/10 border-success/20",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  High: "text-destructive bg-destructive/10 border-destructive/20",
};

export default function StakingPage() {
  const { isConnected } = useAccount();
  const [staking, setStaking] = useState<string | null>(null);
  const [staked, setStaked] = useState<Set<string>>(new Set());
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [positionCount, setPositionCount] = useState(0);

  // Load existing staking positions from DB on mount
  useEffect(() => {
    async function loadPositions() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("staking_positions")
        .select("protocol, status")
        .eq("user_id", user.id)
        .eq("status", "active");
      if (data) {
        const stakedProtocols = new Set(
          data.map((p) => PROTOCOLS.find((pr) => pr.name === p.protocol)?.id).filter(Boolean) as string[]
        );
        setStaked(stakedProtocols);
        setPositionCount(data.length);
      }
    }
    loadPositions();
  }, []);

  async function handleStake(protocolId: string, protocolName: string, apy: number, token: string) {
    const amount = amounts[protocolId];
    if (!amount || parseFloat(amount) <= 0) {
      setError("Bitte einen Betrag eingeben.");
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
      amount,
      apy_at_stake: apy,
      status: "active",
    });

    if (dbErr) {
      setError("Fehler: " + dbErr.message);
    } else {
      setStaked((prev) => new Set(prev).add(protocolId));
      setPositionCount((prev) => prev + 1);
    }
    setStaking(null);
  }

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

      {/* APY Summary */}
      <motion.div
        className="grid grid-cols-3 gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: "Ø APY", value: "3.9%", icon: TrendingUp },
          { label: "Protokolle", value: "4", icon: Zap },
          { label: "Deine Positionen", value: positionCount.toString(), icon: Lock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isConnected && (
        <div className="glass rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground border border-white/5">
          <Info className="w-4 h-4 flex-shrink-0" />
          Verbinde deine Wallet um zu staken.
        </div>
      )}

      {/* Protocol Cards */}
      <div className="space-y-4">
        {PROTOCOLS.map((p, i) => (
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-success">{p.apy}%</p>
                <p className="text-xs text-muted-foreground">APY</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder={`Betrag in ${p.token}`}
                  value={amounts[p.id] ?? ""}
                  onChange={(e) => setAmounts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                />
              </div>

              <div className="text-xs text-muted-foreground whitespace-nowrap">
                TVL: {p.tvl}
              </div>

              <AnimatePresence mode="wait">
                {staked.has(p.id) ? (
                  <motion.div
                    key="done"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 text-success text-sm font-medium"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Gestaked
                  </motion.div>
                ) : (
                  <motion.button
                    key="btn"
                    onClick={() => handleStake(p.id, p.name, p.apy, p.token)}
                    disabled={!isConnected || staking === p.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-secondary/20 border border-secondary/30 text-secondary rounded-lg text-sm font-medium hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                  >
                    {staking === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    Staken
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <ExternalLink className="w-3 h-3" />
        Alle APY-Werte sind Simulationen. Kein echtes Kapital wird bewegt.
      </div>
    </div>
  );
}
