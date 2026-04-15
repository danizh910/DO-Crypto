"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ConnectKitButton } from "connectkit";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      // Map Supabase error codes to German user-friendly messages
      const msg: Record<string, string> = {
        "Invalid login credentials": "E-Mail oder Passwort falsch.",
        "Email not confirmed": "E-Mail noch nicht bestätigt.",
        "Database error querying schema": "Datenbankverbindung fehlgeschlagen — bitte kurz warten und nochmal versuchen.",
        "Too many requests": "Zu viele Versuche. Bitte warte einen Moment.",
      };
      setError(msg[error.message] ?? error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/portfolio");
      router.refresh();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="glass rounded-2xl p-8 w-full max-w-md mx-auto"
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 mb-4">
          <span className="text-primary font-bold text-lg">D</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="text-primary">DO</span>
          <span className="text-foreground"> Crypto</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Secure Banking Portal</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5"
          >
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-destructive text-xs leading-relaxed">{error}</p>
          </motion.div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-background font-semibold py-3 rounded-xl text-sm hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Anmelden…" : "Anmelden"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-muted-foreground text-xs">oder Wallet verbinden</span>
        <div className="h-px flex-1 bg-white/8" />
      </div>

      <div className="flex justify-center">
        <ConnectKitButton />
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Testnet-only · Kein echtes Kapital
      </p>
    </motion.div>
  );
}
