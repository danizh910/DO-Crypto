"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Settings,
  User,
  Wallet,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Copy,
  Loader2,
} from "lucide-react";
import type { Wallet as WalletType } from "@/lib/supabase/types";

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [userId, setUserId]     = useState("");
  const [wallets, setWallets]   = useState<WalletType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setEmail(user.email ?? "Anonym");
      setUserId(user.id);
      const { data } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setWallets(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const section = "glass rounded-2xl p-6 space-y-4";

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Einstellungen</h1>
        </div>
        <p className="text-muted-foreground text-sm">Konto & Sicherheitseinstellungen.</p>
      </motion.div>

      {/* Account */}
      <motion.div className={section} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-white/5 pb-3">
          <User className="w-4 h-4" />
          <span className="font-medium">Konto</span>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Lädt…</div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">E-Mail</span>
              <span className="text-sm text-foreground font-medium">{email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">User ID</span>
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground font-mono">{userId.slice(0, 16)}…</code>
                <button onClick={() => copy(userId)} className="text-muted-foreground hover:text-primary transition-colors">
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Connected Wallet */}
      <motion.div className={section} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-white/5 pb-3">
          <Wallet className="w-4 h-4" />
          <span className="font-medium">Verbundene Wallet</span>
        </div>
        {isConnected && address ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-success/5 border border-success/15 rounded-xl px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <code className="text-xs font-mono text-foreground flex-1 break-all">{address}</code>
            </div>
            <div className="flex justify-center">
              <ConnectKitButton />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-sm text-muted-foreground">Keine Wallet verbunden</p>
            <ConnectKitButton />
          </div>
        )}
      </motion.div>

      {/* Verified Wallets */}
      <motion.div className={section} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-b border-white/5 pb-3">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-medium">Verifizierte Wallets</span>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Lädt…</div>
        ) : wallets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Noch keine verifizierten Wallets.</p>
            <a href="/satoshi-test" className="text-xs text-primary hover:underline">
              Satoshi-Test starten →
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <div key={w.id} className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${w.is_verified ? "bg-success" : "bg-muted-foreground"}`} />
                <code className="flex-1 text-xs font-mono text-foreground truncate">{w.address}</code>
                <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  w.is_verified
                    ? "text-success bg-success/10 border-success/20"
                    : "text-muted-foreground bg-card border-border"
                }`}>
                  {w.is_verified ? "Verifiziert" : "Ausstehend"}
                </span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 border border-destructive/30 text-destructive rounded-xl hover:bg-destructive/5 disabled:opacity-60 transition-all text-sm font-medium"
        >
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          {loggingOut ? "Abmelden…" : "Abmelden"}
        </button>
      </motion.div>
    </div>
  );
}
