"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Bot, User, ChevronLeft, Sparkles } from "lucide-react";
import MarkdownMessage from "@/components/ui/MarkdownMessage";

type EmployeeId = "lena" | "marco" | "sarah";

interface Employee {
  id: EmployeeId;
  name: string;
  role: string;
  avatar: string;
  color: string;
  description: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const EMPLOYEES: Employee[] = [
  {
    id: "lena",
    name: "Lena",
    role: "Kundenberaterin",
    avatar: "L",
    color: "primary",
    description: "Allgemeine Bankfragen, Platform-Support, Kontoverwaltung",
  },
  {
    id: "marco",
    name: "Marco",
    role: "Portfolio Analyst",
    avatar: "M",
    color: "secondary",
    description: "Portfolio-Analyse, DeFi-Empfehlungen, Markteinschätzungen",
  },
  {
    id: "sarah",
    name: "Sarah",
    role: "Compliance & KYC",
    avatar: "S",
    color: "success",
    description: "KYC-Anforderungen, FINMA-Richtlinien, Satoshi-Test, AML",
  },
];

export default function AIPage() {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectEmployee(emp: Employee) {
    setSelected(emp);
    setMessages([]);
    setError(null);
    setLoadingHistory(true);

    // Load conversation history
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingHistory(false); return; }

      const { data } = await supabase
        .from("ai_conversations")
        .select("role, content")
        .eq("user_id", user.id)
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: true })
        .limit(40);

      if (data && data.length > 0) {
        setMessages(data as Message[]);
      } else {
        // Welcome message
        setMessages([{
          role: "assistant",
          content: `Guten Tag! Ich bin ${emp.name}, ${emp.role} bei DO Crypto. Wie kann ich Ihnen heute helfen?`,
        }]);
      }
    } catch {
      // ignore
    }
    setLoadingHistory(false);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selected || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, employeeId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Senden");
        setMessages(prev => prev.slice(0, -1));
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      }
    } catch {
      setError("Verbindungsfehler. Bitte versuche es erneut.");
      setMessages(prev => prev.slice(0, -1));
    }
    setLoading(false);
  }

  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 border-primary/20 text-primary",
    secondary: "bg-secondary/10 border-secondary/20 text-secondary",
    success: "bg-success/10 border-success/20 text-success",
  };

  // Employee selection screen
  if (!selected) {
    return (
      <div className="max-w-3xl space-y-8">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">KI-Mitarbeiter</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Unser KI-Team steht dir rund um die Uhr zur Verfügung. Jeder Mitarbeiter hat Zugriff auf deine Kontodaten
            und merkt sich den Gesprächsverlauf.
          </p>
        </motion.div>

        <div className="grid gap-4">
          {EMPLOYEES.map((emp, i) => (
            <motion.button
              key={emp.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => selectEmployee(emp)}
              className="glass rounded-2xl p-5 flex items-center gap-5 text-left hover:border-white/15 transition-all group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold border flex-shrink-0 ${colorMap[emp.color]}`}>
                {emp.avatar}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground">{emp.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${colorMap[emp.color]}`}>
                    {emp.role}
                  </span>
                  <span className="ml-1 flex items-center gap-1 text-xs text-success">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Online
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{emp.description}</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 group-hover:text-foreground transition-colors flex-shrink-0" />
            </motion.button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          KI-Antworten dienen nur zu Informationszwecken und stellen keine Finanzberatung dar.
        </p>
      </div>
    );
  }

  // Chat screen
  const empColor = colorMap[EMPLOYEES.find(e => e.id === selected.id)?.color ?? "primary"];

  return (
    <div className="max-w-3xl flex flex-col h-[calc(100vh-8rem)]">
      {/* Chat header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-4 flex items-center gap-4 mb-4 flex-shrink-0"
      >
        <button
          onClick={() => setSelected(null)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border flex-shrink-0 ${empColor}`}>
          {selected.avatar}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{selected.name}</p>
            <span className="flex items-center gap-1 text-xs text-success">
              <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
              Online
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{selected.role}</p>
        </div>
        <Bot className="w-4 h-4 text-muted-foreground" />
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Lade Gesprächsverlauf…
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 mt-0.5 ${empColor}`}>
                    {selected.avatar}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary/20 text-foreground rounded-tr-sm text-sm leading-relaxed"
                    : "glass text-foreground rounded-tl-sm"
                }`}>
                  {msg.role === "assistant"
                    ? <MarkdownMessage content={msg.content} />
                    : msg.content
                  }
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${empColor}`}>
              {selected.avatar}
            </div>
            <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {error && (
          <div className="text-center text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-3 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Nachricht an ${selected.name}…`}
          disabled={loading || loadingHistory}
          className="flex-1 bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading || loadingHistory}
          className="flex items-center justify-center w-12 h-12 bg-primary text-background rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
