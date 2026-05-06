"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectKitButton } from "connectkit";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle, CheckCircle2, UserPlus, LogIn, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

type Mode = "login" | "register" | "registered" | "forgot" | "forgot-sent";

export function LoginCard() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet connect → auto sign-in anonymously and redirect
  useEffect(() => {
    if (!isConnected || !address) return;
    setWalletLoading(true);
    const supabase = createClient();
    supabase.auth.signInAnonymously().then(({ error }) => {
      if (!error) {
        router.push("/portfolio");
        router.refresh();
      } else {
        // Anonymous sign-in not enabled → just redirect anyway (middleware will handle)
        router.push("/portfolio");
        router.refresh();
      }
      setWalletLoading(false);
    });
  }, [isConnected, address, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 8000)
    );

    try {
      const supabase = createClient();
      const result = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ]) as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      if (result.error) {
        const msg: Record<string, string> = {
          "Invalid login credentials": "E-Mail oder Passwort falsch.",
          "Email not confirmed": "Bitte bestätige deine E-Mail zuerst.",
          "Too many requests": "Zu viele Versuche. Bitte kurz warten.",
          "Database error querying schema": "Supabase-Verbindungsfehler. Bitte über 'Registrieren' ein neues Konto erstellen.",
        };
        setError(msg[result.error.message] ?? result.error.message);
        return;
      }
      if (result.data.session) {
        router.push("/portfolio");
        router.refresh();
      }
    } catch (err) {
      if ((err as Error).message === "timeout") {
        setError("Verbindung fehlgeschlagen — bitte Seite neu laden.");
      } else {
        setError("Unbekannter Fehler. Bitte nochmal versuchen.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwörter stimmen nicht überein."); return; }
    if (password.length < 8) { setError("Passwort muss mindestens 8 Zeichen haben."); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/portfolio` },
      });
      if (error) {
        const msg: Record<string, string> = {
          "User already registered": "Diese E-Mail ist bereits registriert.",
        };
        setError(msg[error.message] ?? error.message);
        return;
      }
      setMode("registered");
    } catch {
      setError("Registrierung fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Bitte E-Mail eingeben."); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) { setError(error.message); return; }
      setMode("forgot-sent");
    } catch {
      setError("Fehler beim Senden der E-Mail.");
    } finally {
      setLoading(false);
    }
  }

  function reset() { setError(null); setPassword(""); setConfirm(""); }

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

      <AnimatePresence mode="wait">

        {/* Forgot password — sent */}
        {mode === "forgot-sent" && (
          <motion.div key="forgot-sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-success/15 border-2 border-success flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-lg">E-Mail gesendet!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Wir haben einen Reset-Link an <span className="text-foreground font-medium">{email}</span> geschickt.
                Bitte prüfe dein Postfach und klicke auf den Link.
              </p>
            </div>
            <button onClick={() => { setMode("login"); reset(); }} className="text-sm text-primary hover:underline">
              Zurück zum Login →
            </button>
          </motion.div>
        )}

        {/* Forgot password — form */}
        {mode === "forgot" && (
          <motion.div key="forgot" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => { setMode("login"); reset(); }}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                ← Zurück
              </button>
              <span className="text-muted-foreground text-sm">/ Passwort zurücksetzen</span>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen des Passworts.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all" />
              </div>
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-destructive text-xs">{error}</p>
                </motion.div>
              )}
              <button type="submit" disabled={loading || !email.trim()}
                className="w-full bg-primary text-background font-semibold py-3 rounded-xl text-sm hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? "Wird gesendet…" : "Reset-Link senden"}
              </button>
            </form>
          </motion.div>
        )}

        {/* Success state after registration */}
        {mode === "registered" && (
          <motion.div key="registered" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-success/15 border-2 border-success flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground text-lg">Konto erstellt!</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Bestätigungs-E-Mail gesendet an <span className="text-foreground">{email}</span>.
                Bitte E-Mail bestätigen, dann einloggen.
              </p>
            </div>
            <button onClick={() => { setMode("login"); reset(); }} className="text-sm text-primary hover:underline">
              Zum Login →
            </button>
          </motion.div>
        )}

        {mode !== "registered" && mode !== "forgot" && mode !== "forgot-sent" && (
          <motion.div key={mode} initial={{ opacity: 0, x: mode === "register" ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>

            {/* Toggle */}
            <div className="flex bg-white/5 rounded-xl p-1 mb-6">
              {(["login", "register"] as Mode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); reset(); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                    mode === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {m === "login" ? <><LogIn className="w-3.5 h-3.5" /> Anmelden</> : <><UserPlus className="w-3.5 h-3.5" /> Registrieren</>}
                </button>
              ))}
            </div>

            <form onSubmit={mode === "login" ? handleLogin : handleRegister} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all" />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input type={showPassword ? "text" : "password"} placeholder="Passwort" value={password}
                  onChange={(e) => setPassword(e.target.value)} required
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === "register" && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input type={showPassword ? "text" : "password"} placeholder="Passwort bestätigen"
                    value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all" />
                </motion.div>
              )}

              {mode === "login" && (
                <div className="flex justify-end -mt-1">
                  <button type="button" onClick={() => { setMode("forgot"); reset(); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Passwort vergessen?
                  </button>
                </div>
              )}

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-destructive text-xs leading-relaxed">{error}</p>
                </motion.div>
              )}

              <button type="submit" disabled={loading}
                className="w-full bg-primary text-background font-semibold py-3 rounded-xl text-sm hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? (mode === "login" ? "Anmelden…" : "Registrieren…") : (mode === "login" ? "Anmelden" : "Konto erstellen")}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet section */}
      {mode !== "registered" && mode !== "forgot" && mode !== "forgot-sent" && (
        <>
          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-white/8" />
            <span className="text-muted-foreground text-xs">oder Wallet verbinden</span>
            <div className="h-px flex-1 bg-white/8" />
          </div>
          <div className="flex justify-center">
            {walletLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Verbinde…
              </div>
            ) : (
              <ConnectKitButton />
            )}
          </div>
        </>
      )}

      <p className="text-center text-xs text-muted-foreground mt-6">
        Testnet-only · Kein echtes Kapital
      </p>
    </motion.div>
  );
}
