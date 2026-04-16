"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Shield, RefreshCw, Play, Filter, ChevronDown,
  Clock, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { AGENT_REGISTRY } from "@/lib/agents/agent_registry";

interface AgentLog {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_level: number;
  action: string;
  status: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface StatsData {
  totalUsers: number;
  pendingKyc: number;
  txToday: number;
}

const STATUS_COLORS: Record<string, string> = {
  completed: "text-success bg-success/10",
  running:   "text-primary bg-primary/10",
  failed:    "text-red-400 bg-red-400/10",
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  completed: CheckCircle2,
  running:   Loader2,
  failed:    AlertCircle,
};

const LEVEL_LABELS: Record<number, string> = {
  1: "Worker",
  2: "Manager",
  3: "Owner",
};

const AGENT_OPTIONS = [
  { value: "", label: "Alle Agents" },
  ...Object.values(AGENT_REGISTRY).map((a) => ({ value: a.id, label: a.name })),
];

const STATUS_OPTIONS = [
  { value: "", label: "Alle Status" },
  { value: "completed", label: "Abgeschlossen" },
  { value: "running",   label: "Läuft" },
  { value: "failed",    label: "Fehler" },
];

const PERIOD_OPTIONS = [
  { value: "1h",  label: "Letzte Stunde" },
  { value: "24h", label: "Letzte 24h" },
  { value: "7d",  label: "Letzte 7 Tage" },
  { value: "all", label: "Alle" },
];

export default function AdminAgentsPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [filterAgent, setFilterAgent]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("24h");

  // Manual trigger
  const [triggerAgent, setTriggerAgent] = useState("aria");
  const [triggerMsg, setTriggerMsg]     = useState("");
  const [triggering, setTriggering]     = useState(false);
  const [triggerResult, setTriggerResult] = useState("");

  const fetchLogs = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/agents/status");
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Fehler beim Laden");
        return;
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setStats(data.stats ?? null);
      setError("");
    } catch {
      setError("Netzwerkfehler");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  async function handleTrigger() {
    if (!triggerMsg.trim()) return;
    setTriggering(true);
    setTriggerResult("");
    try {
      const res = await fetch("/api/agents/groq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: triggerAgent, message: triggerMsg }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTriggerResult(`Fehler: ${data.error}`);
      } else {
        setTriggerResult(data.response);
        setTriggerMsg("");
        setTimeout(fetchLogs, 1000);
      }
    } catch {
      setTriggerResult("Netzwerkfehler");
    } finally {
      setTriggering(false);
    }
  }

  // Apply filters
  const now = Date.now();
  const PERIOD_MS: Record<string, number> = {
    "1h":  3600_000,
    "24h": 86_400_000,
    "7d":  604_800_000,
    "all": Infinity,
  };

  const filtered = logs.filter((log) => {
    if (filterAgent && log.agent_id !== filterAgent) return false;
    if (filterStatus && log.status !== filterStatus) return false;
    const age = now - new Date(log.created_at).getTime();
    if (age > PERIOD_MS[filterPeriod]) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 gap-2">
        <AlertCircle className="w-5 h-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agent Monitoring</h1>
            <p className="text-sm text-muted-foreground">Vollständige Log-Übersicht & manuelle Steuerung</p>
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg glass text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Aktualisieren
        </button>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Gesamt Benutzer", value: stats.totalUsers },
            { label: "Offenes KYC",     value: stats.pendingKyc },
            { label: "TX heute",        value: stats.txToday },
          ].map(({ label, value }) => (
            <div key={label} className="glass rounded-xl p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Manual trigger */}
      <div className="glass rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Agent forcieren</h2>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <select
              value={triggerAgent}
              onChange={(e) => setTriggerAgent(e.target.value)}
              className="appearance-none glass rounded-lg px-3 py-2 text-sm text-foreground bg-transparent pr-8 focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {Object.values(AGENT_REGISTRY).map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.name} (Lvl {a.level})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
          <input
            type="text"
            value={triggerMsg}
            onChange={(e) => setTriggerMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTrigger()}
            placeholder="Anfrage eingeben…"
            className="flex-1 glass rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={handleTrigger}
            disabled={triggering || !triggerMsg.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Ausführen
          </button>
        </div>
        {triggerResult && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-foreground/80 bg-white/5 rounded-lg p-3 border border-white/5 whitespace-pre-wrap"
          >
            {triggerResult}
          </motion.div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {/* Agent filter */}
        <div className="relative">
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="appearance-none glass rounded-lg px-3 py-2 text-sm text-foreground bg-transparent pr-8 focus:outline-none"
          >
            {AGENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {/* Status filter */}
        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none glass rounded-lg px-3 py-2 text-sm text-foreground bg-transparent pr-8 focus:outline-none"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        {/* Period filter */}
        <div className="relative">
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="appearance-none glass rounded-lg px-3 py-2 text-sm text-foreground bg-transparent pr-8 focus:outline-none"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-card">{o.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} Einträge</span>
      </div>

      {/* Log table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium">Zeit</th>
                <th className="text-left px-4 py-3 font-medium">Agent</th>
                <th className="text-left px-4 py-3 font-medium">Level</th>
                <th className="text-left px-4 py-3 font-medium">Aktion</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-muted-foreground">
                    Keine Log-Einträge gefunden
                  </td>
                </tr>
              ) : (
                filtered.map((log, i) => {
                  const StatusIcon = STATUS_ICONS[log.status] ?? CheckCircle2;
                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString("de-CH", {
                            day: "2-digit", month: "2-digit",
                            hour: "2-digit", minute: "2-digit", second: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{log.agent_name}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                          {LEVEL_LABELS[log.agent_level] ?? `Lvl ${log.agent_level}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground/80 max-w-xs truncate">{log.action}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[log.status] ?? "text-muted-foreground bg-white/5"}`}>
                          <StatusIcon className={`w-3 h-3 ${log.status === "running" ? "animate-spin" : ""}`} />
                          {log.status}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
