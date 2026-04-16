"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Send, Loader2, Users, Activity,
  AlertTriangle, TrendingUp, RefreshCw, ChevronRight,
} from "lucide-react";
import type { AgentLog } from "@/lib/agents/agent_hierarchy";
import { AGENT_REGISTRY } from "@/lib/agents/agent_registry";

interface Message { role: "user" | "assistant"; content: string }
interface Stats { totalUsers: number; pendingKyc: number; txToday: number }

const COLOR_MAP: Record<string, string> = {
  primary:   "text-primary bg-primary/10 border-primary/20",
  secondary: "text-secondary bg-secondary/10 border-secondary/20",
  success:   "text-success bg-success/10 border-success/20",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-success animate-pulse",
  idle:   "bg-yellow-400",
  error:  "bg-destructive",
};

export default function AdminPage() {
  const [logs, setLogs]         = useState<AgentLog[]>([]);
  const [stats, setStats]       = useState<Stats>({ totalUsers: 0, pendingKyc: 0, txToday: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [sending, setSending]   = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/status");
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
      setStats(data.stats ?? {});
    } catch { /* ignore */ }
    setLoadingStatus(false);
  }, []);

  // Poll every 6 seconds
  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 6000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Welcome message from ARIA
  useEffect(() => {
    setMessages([{
      role: "assistant",
      content: "Guten Tag, Daniel. Ich bin ARIA, Ihre AI-Managerin. Alle Systeme laufen normal. Wie kann ich Ihnen heute helfen? Ich kann Aufgaben an den Compliance-, Market-, Risk- oder Support-Agent delegieren.",
    }]);
  }, []);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      const res = await fetch("/api/agents/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "aria",
          message: userMsg,
          history: messages.slice(-8),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
        // Refresh logs after ARIA responds
        setTimeout(fetchStatus, 1000);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `Fehler: ${data.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Verbindungsfehler." }]);
    }
    setSending(false);
  }

  const aria    = AGENT_REGISTRY["aria"];
  const workers = ["compliance", "market", "risk", "support"].map(id => AGENT_REGISTRY[id]);

  // Determine live status from recent logs (fiveMin computed outside render via useMemo)
  const fiveMinAgo = useMemo(() => Date.now() - 5 * 60 * 1000, [logs]);
  function agentLiveStatus(agentId: string): "active" | "idle" {
    return logs.some(l => l.agent_id === agentId && new Date(l.created_at).getTime() > fiveMinAgo)
      ? "active" : "idle";
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Governance Board</h1>
            <p className="text-muted-foreground text-xs">Level 3 — Daniel (Owner)</p>
          </div>
        </div>
        <button onClick={fetchStatus}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Aktualisieren
        </button>
      </motion.div>

      {/* Stats bar */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Aktive Kunden", value: stats.totalUsers, color: "text-primary" },
          { icon: AlertTriangle, label: "KYC ausstehend", value: stats.pendingKyc, color: "text-yellow-400" },
          { icon: TrendingUp, label: "Transaktionen (24h)", value: stats.txToday, color: "text-success" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4 flex items-center gap-3">
            <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Agent status panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-5 col-span-12 md:col-span-4 space-y-4">
          <p className="text-sm font-medium text-foreground border-b border-white/5 pb-3">
            Agent-Status
          </p>

          {/* ARIA — manager */}
          <motion.div
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border ${COLOR_MAP[aria.color]}`}>
              {aria.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{aria.name}</p>
                <span className="text-xs text-primary">Manager</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{aria.role}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-success flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Online
            </div>
          </motion.div>

          <div className="pl-4 border-l-2 border-white/5 space-y-2">
            {workers.map((agent) => {
              const live = agentLiveStatus(agent.id);
              return (
                <div key={agent.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/3 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold border flex-shrink-0 ${COLOR_MAP[agent.color]}`}>
                    {agent.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{agent.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[live]}`} />
                </div>
              );
            })}
          </div>

          <a href="/admin/agents"
            className="flex items-center justify-between text-xs text-muted-foreground hover:text-primary transition-colors pt-2 border-t border-white/5">
            <span>Agent-Logs ansehen</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </motion.div>

        {/* Activity feed */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="glass rounded-2xl col-span-12 md:col-span-8 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Live Activity</p>
            </div>
            {!loadingStatus && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-64">
            {loadingStatus ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Lade Aktivitäten…
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 gap-2 text-center">
                <p className="text-muted-foreground text-sm">Noch keine Aktivitäten.</p>
                <p className="text-xs text-muted-foreground">Sende eine Nachricht an ARIA um zu starten.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-white/3 transition-colors"
                  >
                    <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${COLOR_MAP[AGENT_REGISTRY[log.agent_id]?.color ?? "primary"]}`}>
                      {log.agent_name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{log.agent_name}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                          log.status === "completed" ? "text-success bg-success/10 border-success/20"
                          : log.status === "running" ? "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"
                          : "text-destructive bg-destructive/10 border-destructive/20"
                        }`}>
                          {log.status === "completed" ? "✓" : log.status === "running" ? "⟳" : "✕"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{log.action}</p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {new Date(log.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>

        {/* ARIA Chat */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="glass rounded-2xl col-span-12 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
            <motion.div
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary"
            >
              AR
            </motion.div>
            <div>
              <p className="text-sm font-medium text-foreground">Chat mit ARIA</p>
              <p className="text-xs text-muted-foreground">AI Manager · Level 2</p>
            </div>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Aktiv
            </span>
          </div>

          {/* Messages */}
          <div className="overflow-y-auto max-h-72 p-5 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 mt-0.5">
                      AR
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary/20 text-foreground rounded-tr-sm"
                      : "glass text-foreground rounded-tl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  AR
                </div>
                <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }} />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage}
            className="flex gap-3 px-5 pb-5 pt-2 border-t border-white/5 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Befehl an ARIA eingeben… (z.B. 'Gib mir einen Marktbericht')"
              disabled={sending}
              className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
            />
            <button type="submit" disabled={!input.trim() || sending}
              className="flex items-center justify-center w-10 h-10 bg-primary text-background rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
