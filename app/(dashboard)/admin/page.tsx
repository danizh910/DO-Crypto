"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, RefreshCw, Send, Loader2, Bot, Activity,
  Users, AlertTriangle, BookOpen, TrendingUp,
  CheckCircle2, XCircle, Clock, ArrowUpRight, ArrowDownLeft,
  BarChart3, Layers, Zap, ChevronDown, X,
  Eye, Play, Filter,
} from "lucide-react";
import { AGENT_REGISTRY } from "@/lib/agents/agent_registry";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AgentLog  { id: string; agent_id: string; agent_name: string; agent_level: number; action: string; status: string; metadata?: Record<string, unknown>; created_at: string; }
interface Customer  { id: string; first_name?: string; last_name?: string; onboarding_complete: boolean; created_at: string; nationality?: string; city?: string; country?: string; phone?: string; address_line?: string; postal_code?: string; date_of_birth?: string; wallet_verified: boolean; }
interface TxRow     { id: string; user_id: string; amount: string; token: string; direction: "in"|"out"; status: string; tx_hash?: string; created_at: string; }
interface OverviewData {
  stats: { totalUsers: number; pendingKyc: number; txToday: number; activeStaking: number; totalVolume: string; totalSwaps: number; };
  customers: Customer[];
  recentTx: TxRow[];
  largeTx: TxRow[];
  stakingByProtocol: Record<string, { count: number; totalETH: number }>;
}
type Tab = "overview" | "agents" | "customers" | "compliance" | "monitoring" | "docs";

// ── Docs content ──────────────────────────────────────────────────────────────
const DOCS = [
  {
    title: "KYC / Satoshi-Test Prozess",
    content: `Der Satoshi-Test ist das KYC-Verfahren der DO Crypto Bank:
1. Nutzer gibt externe Wallet-Adresse an
2. System generiert einen zufälligen Micro-Betrag (0.0001–0.0009 ETH)
3. Nutzer sendet exakt diesen Betrag an die Vault-Adresse
4. Backend prüft Ethereum Sepolia auf eingehende TX
5. Bei Übereinstimmung: wallets.is_verified = true
Technisch: Alchemy RPC + Viem publicClient, Chain ID 11155111 (Sepolia)`,
  },
  {
    title: "Staking-Mechanismus",
    content: `DO Crypto simuliert DeFi-Staking:
• Lido (stETH): 3.8% APY — Liquid Staking, täglich akkumulierende Rewards
• Aave v3 (aETH): 2.1% APY — Lending-Protokoll, ETH als Sicherheit
• Rocket Pool (rETH): 3.5% APY — Dezentrales Staking
• EigenLayer (restETH): 6.2% APY — Restaking mit erhöhtem Risiko
Rewards = Betrag × (APY/100) × (Tage/365)
Entstaken gibt Kapital + Rewards als ETH zurück (Transaktion direction=in)`,
  },
  {
    title: "Swap-Mechanismus",
    content: `Token-Swaps werden simuliert mit festen Referenzkursen:
• ETH/stETH: 0.9996 (Lido Exchange Rate)
• ETH/rETH: 0.9251 (Rocket Pool Rate)
• ETH/USDC: ~3247 CHF-Äquivalent
Alle Swaps werden in swap_transactions gespeichert.
Echte Integration: Uniswap v3 Router auf Sepolia möglich.`,
  },
  {
    title: "Krypto Kaufen",
    content: `Kaufprozess (simuliert):
• Live-Preise via CoinGecko Free API (60s Cache)
• Verfügbare Währungen: CHF, EUR, USD
• Tokens: ETH, BTC, LINK, UNI
• Kauf wird in purchase_transactions gespeichert
• Zusätzlich in transactions als direction=in erfasst (Portfolio-Ansicht)
Mindestbetrag: 10 Fiat-Einheiten`,
  },
  {
    title: "AI-Agenten Architektur",
    content: `Hierarchisches Multi-Agent System:
Level 3: Daniel (Owner) — Interagiert über Admin-Board
Level 2: ARIA (Manager) — Koordiniert, delegiert, berichtet
Level 1: Compliance, Market, Risk, Support (Workers)

Jeder Agent erhält:
• Echtzeit-Datenbankkontext (Kunden, Transaktionen, Staking)
• Gesprächsgedächtnis (letzte 16 Nachrichten aus ai_conversations)
• Spezialisierte Systemprompts

Delegation: ARIA erkennt Keywords und loggt Worker-Tasks in agent_logs.`,
  },
  {
    title: "Datenbankschema",
    content: `Supabase PostgreSQL mit Row Level Security:
• profiles — Kundendaten (KYC, Adresse, Onboarding-Status)
• wallets — Wallet-Adressen + Satoshi-Verifikation
• transactions — On-Chain TX-History (direction: in/out)
• staking_positions — DeFi-Positionen (status: active/unstaked)
• swap_transactions — Token-Swaps
• purchase_transactions — Krypto-Käufe
• ai_conversations — Agent-Gedächtnis (employee_id, role, content)
• agent_logs — Agent-Aktivitätslogs (für Admin-Board)
• notifications — Nutzer-Benachrichtigungen`,
  },
];

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  // Overview data
  const [overview, setOverview]   = useState<OverviewData | null>(null);
  const [ovLoading, setOvLoading] = useState(false);

  // Agents data
  const [logs, setLogs]           = useState<AgentLog[]>([]);
  const [agLoading, setAgLoading] = useState(false);

  // ARIA chat
  const [message, setMessage]       = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: string; content: string; agent?: string }>>([]);
  const [sending, setSending]         = useState(false);
  const [activeAgent, setActiveAgent] = useState("aria");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Docs
  const [openDoc, setOpenDoc] = useState<number | null>(null);

  // Customer detail modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Monitoring — agent force trigger
  const [forceAgent, setForceAgent] = useState("aria");
  const [forceTask, setForceTask] = useState("");
  const [forceResult, setForceResult] = useState<string | null>(null);
  const [forceLoading, setForceLoading] = useState(false);
  const [logFilter, setLogFilter] = useState<string>("all");

  const fetchOverview = useCallback(async () => {
    setOvLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      if (res.ok) setOverview(await res.json());
    } catch { /* silent */ }
    setOvLoading(false);
  }, []);

  const fetchAgents = useCallback(async () => {
    setAgLoading(true);
    try {
      const res = await fetch("/api/agents/status");
      if (res.ok) {
        const d = await res.json();
        setLogs(d.logs ?? []);
      }
    } catch { /* silent */ }
    setAgLoading(false);
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { if (tab === "agents" || tab === "monitoring") fetchAgents(); }, [tab, fetchAgents]);

  // Auto-refresh agents/monitoring tab every 8s when active
  useEffect(() => {
    if (tab !== "agents" && tab !== "monitoring") return;
    const id = setInterval(fetchAgents, 8000);
    return () => clearInterval(id);
  }, [tab, fetchAgents]);

  async function forceAgentTask() {
    if (!forceTask.trim() || forceLoading) return;
    setForceLoading(true);
    setForceResult(null);
    try {
      const res = await fetch("/api/agents/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: forceAgent, message: forceTask, history: [] }),
      });
      const data = await res.json();
      setForceResult(res.ok ? data.response : `Fehler: ${data.error}`);
      fetchAgents();
    } catch {
      setForceResult("Netzwerkfehler");
    }
    setForceLoading(false);
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const agentLiveStatus = useCallback((agentId: string): "active" | "idle" => {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    return logs.some(l => l.agent_id === agentId && new Date(l.created_at).getTime() > fiveMinAgo)
      ? "active" : "idle";
  }, [logs]);

  async function sendMessage() {
    if (!message.trim() || sending) return;
    const userMsg = message.trim();
    setMessage("");
    setSending(true);
    setChatHistory(h => [...h, { role: "user", content: userMsg }]);

    try {
      const res = await fetch("/api/agents/groq", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          agentId: activeAgent,
          message: userMsg,
          history: chatHistory.filter(m => m.role !== "system").slice(-8).map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setChatHistory(h => [...h, { role: "assistant", content: data.response, agent: data.agentName }]);
        fetchAgents();
      } else {
        setChatHistory(h => [...h, { role: "system", content: `Fehler: ${data.error}` }]);
      }
    } catch {
      setChatHistory(h => [...h, { role: "system", content: "Netzwerkfehler" }]);
    }
    setSending(false);
  }

  const workers = ["compliance", "market", "risk", "support"].map(id => AGENT_REGISTRY[id]);

  const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "overview",    label: "Übersicht",     icon: BarChart3 },
    { id: "agents",      label: "KI-Belegschaft", icon: Bot },
    { id: "customers",   label: "Kunden",         icon: Users },
    { id: "compliance",  label: "Compliance",     icon: AlertTriangle },
    { id: "monitoring",  label: "Monitoring",     icon: Activity },
    { id: "docs",        label: "Dokumentation",  icon: BookOpen },
  ];

  return (
    <div className="max-w-7xl space-y-6">

      {/* ── Customer detail modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70" onClick={() => setSelectedCustomer(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="glass rounded-2xl p-6 w-full max-w-lg space-y-5 border border-white/10 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                      {(selectedCustomer.first_name?.[0] ?? "?")}{(selectedCustomer.last_name?.[0] ?? "?")}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {selectedCustomer.first_name && selectedCustomer.last_name
                          ? `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
                          : "Unbekannter Nutzer"}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">{selectedCustomer.id.slice(0, 20)}…</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedCustomer(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "KYC-Status", value: selectedCustomer.onboarding_complete ? "Abgeschlossen" : "Ausstehend", ok: selectedCustomer.onboarding_complete },
                    { label: "Wallet", value: selectedCustomer.wallet_verified ? "Verifiziert" : "Nicht verifiziert", ok: selectedCustomer.wallet_verified },
                  ].map(({ label, value, ok }) => (
                    <div key={label} className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-muted-foreground mb-1">{label}</p>
                      <p className={`text-sm font-semibold flex items-center gap-1 ${ok ? "text-success" : "text-yellow-400"}`}>
                        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 text-sm">
                  {[
                    { label: "Vorname", value: selectedCustomer.first_name },
                    { label: "Nachname", value: selectedCustomer.last_name },
                    { label: "Geburtsdatum", value: selectedCustomer.date_of_birth },
                    { label: "Nationalität", value: selectedCustomer.nationality },
                    { label: "Land", value: selectedCustomer.country },
                    { label: "Stadt", value: selectedCustomer.city },
                    { label: "PLZ", value: selectedCustomer.postal_code },
                    { label: "Adresse", value: selectedCustomer.address_line },
                    { label: "Telefon", value: selectedCustomer.phone },
                    { label: "Registriert", value: new Date(selectedCustomer.created_at).toLocaleDateString("de-CH") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className="text-foreground text-xs font-medium">{value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Admin Board</h1>
            <p className="text-muted-foreground text-xs">DO Crypto Bank — Vollständige Übersicht</p>
          </div>
        </div>
        <button onClick={() => { fetchOverview(); if (tab === "agents") fetchAgents(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${ovLoading || agLoading ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </motion.div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 p-1 glass rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── ÜBERSICHT TAB ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: "Kunden",         value: overview?.stats.totalUsers    ?? "—", icon: Users,       color: "text-primary" },
                { label: "Offenes KYC",    value: overview?.stats.pendingKyc    ?? "—", icon: AlertTriangle, color: "text-yellow-400" },
                { label: "TX Heute",       value: overview?.stats.txToday       ?? "—", icon: Activity,    color: "text-success" },
                { label: "Aktive Stakings",value: overview?.stats.activeStaking ?? "—", icon: Layers,      color: "text-secondary" },
                { label: "Gesamt Volumen", value: overview ? `${overview.stats.totalVolume} ETH` : "—", icon: TrendingUp, color: "text-success" },
                { label: "Swaps",          value: overview?.stats.totalSwaps    ?? "—", icon: Zap,         color: "text-primary" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="glass rounded-xl p-4">
                  <Icon className={`w-4 h-4 ${color} mb-2`} />
                  <p className="text-xl font-bold text-foreground">{String(value)}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent transactions */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Letzte Transaktionen
                </h3>
                <div className="space-y-2">
                  {(overview?.recentTx ?? []).slice(0, 8).map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 text-sm">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        tx.direction === "in" ? "bg-success/10" : "bg-destructive/10"
                      }`}>
                        {tx.direction === "in"
                          ? <ArrowDownLeft className="w-3.5 h-3.5 text-success" />
                          : <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {tx.user_id.slice(0, 12)}…
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${tx.direction === "in" ? "text-success" : "text-destructive"}`}>
                        {tx.direction === "in" ? "+" : "-"}{parseFloat(tx.amount).toFixed(4)} {tx.token}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(tx.created_at).toLocaleDateString("de-CH")}
                      </span>
                    </div>
                  ))}
                  {!overview?.recentTx.length && (
                    <p className="text-xs text-muted-foreground text-center py-4">Keine Transaktionen</p>
                  )}
                </div>
              </div>

              {/* Staking by protocol */}
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-secondary" /> Staking nach Protokoll
                </h3>
                <div className="space-y-3">
                  {Object.entries(overview?.stakingByProtocol ?? {}).map(([protocol, data]) => (
                    <div key={protocol} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{protocol}</span>
                        <span className="text-muted-foreground">{data.count} Positionen · {data.totalETH.toFixed(4)} ETH</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-secondary to-primary"
                          style={{ width: `${Math.min(100, data.totalETH * 20)}%` }} />
                      </div>
                    </div>
                  ))}
                  {!Object.keys(overview?.stakingByProtocol ?? {}).length && (
                    <p className="text-xs text-muted-foreground text-center py-4">Keine aktiven Staking-Positionen</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── AGENTEN TAB ─────────────────────────────────────────────────── */}
        {tab === "agents" && (
          <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Agent grid */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* ARIA */}
              <div className="md:col-span-2 glass rounded-2xl p-4 border border-primary/20">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">AR</div>
                    <div>
                      <p className="font-semibold text-foreground">ARIA</p>
                      <p className="text-xs text-muted-foreground">AI Manager · Level 2</p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${
                    agentLiveStatus("aria") === "active" ? "bg-success/10 text-success" : "bg-white/5 text-muted-foreground"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${agentLiveStatus("aria") === "active" ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
                    {agentLiveStatus("aria") === "active" ? "Aktiv" : "Bereit"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Koordiniert Worker-Team, hat vollen Datenbankzugriff</p>
              </div>

              {/* Workers */}
              {workers.map((worker) => worker && (
                <div key={worker.id} className="glass rounded-2xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg bg-${worker.color}/10 border border-${worker.color}/20 flex items-center justify-center text-xs font-bold text-${worker.color}`}>
                      {worker.avatar}
                    </div>
                    <span className={`w-2 h-2 rounded-full mt-1 ${agentLiveStatus(worker.id) === "active" ? "bg-success animate-pulse" : "bg-white/20"}`} />
                  </div>
                  <p className="text-sm font-semibold text-foreground mt-2">{worker.name}</p>
                  <p className="text-xs text-muted-foreground">{worker.role}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ARIA Chat */}
              <div className="glass rounded-2xl flex flex-col" style={{ height: "480px" }}>
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Agent Chat</span>
                  </div>
                  <select
                    value={activeAgent}
                    onChange={(e) => setActiveAgent(e.target.value)}
                    className="text-xs bg-transparent text-muted-foreground focus:outline-none border border-white/10 rounded-lg px-2 py-1"
                  >
                    {Object.values(AGENT_REGISTRY).map(a => (
                      <option key={a.id} value={a.id} className="bg-card">{a.name} (Lvl {a.level})</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {chatHistory.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-muted-foreground text-center">
                        Stelle {AGENT_REGISTRY[activeAgent]?.name ?? "dem Agent"} eine Frage.<br />
                        <span className="opacity-60">Echte Bankdaten werden injiziert.</span>
                      </p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary/15 text-foreground"
                          : msg.role === "system"
                          ? "bg-destructive/10 text-destructive text-xs"
                          : "bg-white/5 text-foreground"
                      }`}>
                        {msg.role === "assistant" && (
                          <p className="text-xs text-primary mb-1 font-medium">{msg.agent ?? "Agent"}</p>
                        )}
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="bg-white/5 rounded-xl px-3 py-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-3 border-t border-white/5">
                  <div className="flex gap-2">
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder={`Nachricht an ${AGENT_REGISTRY[activeAgent]?.name ?? "Agent"}…`}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <button onClick={sendMessage} disabled={sending || !message.trim()}
                      className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 disabled:opacity-40 transition-colors">
                      {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Live activity feed */}
              <div className="glass rounded-2xl p-4 space-y-3" style={{ height: "480px", overflowY: "auto" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-foreground">Live-Aktivität</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{logs.length} Einträge</span>
                </div>
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Noch keine Aktivität</p>
                ) : (
                  logs.map((log, i) => (
                    <motion.div key={log.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="flex items-start gap-2.5 text-xs">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                        log.status === "completed" ? "bg-success" : log.status === "running" ? "bg-primary animate-pulse" : "bg-destructive"
                      }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-primary font-medium">{log.agent_name}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="text-foreground/80">{log.action}</span>
                        <p className="text-muted-foreground/60 mt-0.5">
                          {new Date(log.created_at).toLocaleTimeString("de-CH")}
                        </p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── KUNDEN TAB ──────────────────────────────────────────────────── */}
        {tab === "customers" && (
          <motion.div key="customers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Kundenliste</span>
                  <span className="text-xs text-muted-foreground">({overview?.customers.length ?? 0} Kunden)</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-xs text-muted-foreground">
                      <th className="text-left px-4 py-3 font-medium">Name</th>
                      <th className="text-left px-4 py-3 font-medium">KYC</th>
                      <th className="text-left px-4 py-3 font-medium">Wallet</th>
                      <th className="text-left px-4 py-3 font-medium">Land</th>
                      <th className="text-left px-4 py-3 font-medium">Seit</th>
                      <th className="text-left px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(overview?.customers ?? []).map((c) => (
                      <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors cursor-pointer"
                        onClick={() => setSelectedCustomer(c)}>
                        <td className="px-4 py-3 font-medium text-foreground">
                          {c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : <span className="text-muted-foreground italic">Unbekannt</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.onboarding_complete
                            ? <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Abgeschlossen</span>
                            : <span className="flex items-center gap-1 text-yellow-400 text-xs"><Clock className="w-3.5 h-3.5" /> Ausstehend</span>}
                        </td>
                        <td className="px-4 py-3">
                          {c.wallet_verified
                            ? <span className="flex items-center gap-1 text-success text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Verifiziert</span>
                            : <span className="flex items-center gap-1 text-muted-foreground text-xs"><XCircle className="w-3.5 h-3.5" /> Nicht verifiziert</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{c.nationality ?? c.city ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {new Date(c.created_at).toLocaleDateString("de-CH")}
                        </td>
                        <td className="px-4 py-3">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                        </td>
                      </tr>
                    ))}
                    {!overview?.customers.length && (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">Keine Kunden</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── COMPLIANCE TAB ──────────────────────────────────────────────── */}
        {tab === "compliance" && (
          <motion.div key="compliance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* KYC pending */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-400" />
                Offene KYC-Verifikationen
                <span className="ml-auto text-yellow-400 font-bold">{overview?.stats.pendingKyc ?? 0}</span>
              </h3>
              <div className="space-y-2">
                {(overview?.customers ?? []).filter(c => !c.onboarding_complete).map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                    <div>
                      <p className="text-sm text-foreground font-medium">
                        {c.first_name && c.last_name ? `${c.first_name} ${c.last_name}` : "Unbekannter Nutzer"}
                      </p>
                      <p className="text-xs text-muted-foreground">{c.nationality ?? "Nationalität unbekannt"}</p>
                    </div>
                    <span className="text-xs text-yellow-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Ausstehend
                    </span>
                  </div>
                ))}
                {!(overview?.customers ?? []).some(c => !c.onboarding_complete) && (
                  <p className="text-xs text-success text-center py-4 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Alle KYC abgeschlossen
                  </p>
                )}
              </div>
            </div>

            {/* Large transactions */}
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                Grosse Transaktionen (&ge;0.01 ETH) — AML Monitoring
              </h3>
              <div className="space-y-2">
                {(overview?.largeTx ?? []).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/3 border border-white/5">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${tx.direction === "in" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {tx.direction === "in"
                          ? <ArrowDownLeft className="w-3 h-3 text-success" />
                          : <ArrowUpRight className="w-3 h-3 text-destructive" />}
                      </div>
                      <div>
                        <p className="text-xs text-foreground font-mono">{tx.user_id.slice(0, 16)}…</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("de-CH")}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-bold ${tx.direction === "in" ? "text-success" : "text-destructive"}`}>
                      {tx.direction === "in" ? "+" : "-"}{parseFloat(tx.amount).toFixed(6)} {tx.token}
                    </span>
                  </div>
                ))}
                {!overview?.largeTx.length && (
                  <p className="text-xs text-success text-center py-4 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Keine auffälligen Transaktionen
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── MONITORING TAB ──────────────────────────────────────────────── */}
        {tab === "monitoring" && (
          <motion.div key="monitoring" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* Force trigger */}
            <div className="glass rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" /> Agent forcieren
              </h3>
              <div className="flex gap-3">
                <select value={forceAgent} onChange={(e) => setForceAgent(e.target.value)}
                  className="w-36 bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/50">
                  {Object.values(AGENT_REGISTRY).map(a => (
                    <option key={a.id} value={a.id} className="bg-card">{a.name}</option>
                  ))}
                </select>
                <input value={forceTask} onChange={(e) => setForceTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && forceAgentTask()}
                  placeholder="Aufgabe eingeben…"
                  className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors" />
                <button onClick={forceAgentTask} disabled={forceLoading || !forceTask.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary/20 text-primary rounded-xl hover:bg-primary/30 disabled:opacity-40 transition-colors text-sm font-medium whitespace-nowrap">
                  {forceLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  Ausführen
                </button>
              </div>
              {forceResult && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  <p className="text-xs text-primary font-medium mb-2">{AGENT_REGISTRY[forceAgent]?.name ?? forceAgent} — Ergebnis</p>
                  {forceResult}
                </motion.div>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Aktive Agenten", value: Object.values(AGENT_REGISTRY).filter(a => agentLiveStatus(a.id) === "active").length },
                { label: "Logs (gesamt)", value: logs.length },
                { label: "Abgeschlossen", value: logs.filter(l => l.status === "completed").length },
                { label: "Laufend", value: logs.filter(l => l.status === "running").length },
              ].map(({ label, value }) => (
                <div key={label} className="glass rounded-xl p-4">
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            {/* Log table with filter */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-success" />
                  <span className="text-sm font-semibold text-foreground">Agent-Logs</span>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select value={logFilter} onChange={(e) => setLogFilter(e.target.value)}
                    className="text-xs bg-transparent text-muted-foreground focus:outline-none border border-white/10 rounded-lg px-2 py-1">
                    <option value="all">Alle</option>
                    {Object.keys(AGENT_REGISTRY).map(id => (
                      <option key={id} value={id}>{AGENT_REGISTRY[id].name}</option>
                    ))}
                  </select>
                  <button onClick={fetchAgents} className="text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`w-3.5 h-3.5 ${agLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>
              <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                {(logFilter === "all" ? logs : logs.filter(l => l.agent_id === logFilter)).map((log) => (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 text-xs hover:bg-white/[0.02] transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      log.status === "completed" ? "bg-success" : log.status === "running" ? "bg-primary animate-pulse" : "bg-destructive"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-primary font-medium">{log.agent_name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs ${
                          log.status === "completed" ? "bg-success/10 text-success" : log.status === "running" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                        }`}>{log.status}</span>
                        <span className="text-muted-foreground/60 ml-auto shrink-0">
                          {new Date(log.created_at).toLocaleString("de-CH")}
                        </span>
                      </div>
                      <p className="text-foreground/80 truncate">{log.action}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Noch keine Logs</p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── DOCS TAB ────────────────────────────────────────────────────── */}
        {tab === "docs" && (
          <motion.div key="docs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-sm text-muted-foreground">Interne Bank-Dokumentation und technische Prozesse.</p>
            {DOCS.map((doc, i) => (
              <div key={i} className="glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenDoc(openDoc === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    {doc.title}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${openDoc === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openDoc === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0 border-t border-white/5">
                        <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed mt-3">
                          {doc.content}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            <div className="glass rounded-xl p-5 border border-primary/10">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Agent Monitoring</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Log-Tabelle, Filter und manueller Agent-Trigger sind im Tab &quot;Monitoring&quot; verfügbar.</p>
              <button onClick={() => setTab("monitoring")} className="text-xs text-primary hover:underline">
                → Zum Monitoring
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
