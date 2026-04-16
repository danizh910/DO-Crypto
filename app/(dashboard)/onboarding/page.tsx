"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  User, ShieldCheck, CheckCircle2, Loader2,
  ChevronRight, AlertCircle, Building2,
} from "lucide-react";

type Step = 1 | 2 | 3;

const COUNTRIES = [
  { code: "CH", name: "Schweiz" }, { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" }, { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" }, { code: "US", name: "USA" },
  { code: "GB", name: "Vereinigtes Königreich" }, { code: "LI", name: "Liechtenstein" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasVerifiedWallet, setHasVerifiedWallet] = useState(false);
  const [checkingWallet, setCheckingWallet] = useState(false);
  const [walletRefresh, setWalletRefresh] = useState(0);

  // Profile form
  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "",
    nationality: "CH", phone: "", address_line: "",
    postal_code: "", city: "", country: "CH",
  });

  function field(name: keyof typeof form) {
    return { value: form[name], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [name]: e.target.value })) };
  }

  useEffect(() => {
    if (step !== 2) return;
    setCheckingWallet(true);
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setCheckingWallet(false); return; }
      supabase
        .from("wallets")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_verified", true)
        .limit(1)
        .then(({ data }) => {
          setHasVerifiedWallet((data?.length ?? 0) > 0);
          setCheckingWallet(false);
        });
    });
  }, [step, walletRefresh]);

  async function saveProfile() {
    if (!form.first_name || !form.last_name || !form.date_of_birth) {
      setError("Bitte fülle alle Pflichtfelder aus.");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { error: dbErr } = await supabase
      .from("profiles")
      .update({ ...form })
      .eq("id", user.id);
    if (dbErr) { setError(dbErr.message); setLoading(false); return; }
    setStep(2);
    setLoading(false);
  }

  async function completeOnboarding() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    // Mark in profiles + user metadata
    await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
    await supabase.auth.updateUser({ data: { onboarding_complete: true } });
    // Refresh session so middleware JWT contains updated metadata
    await supabase.auth.refreshSession();
    router.refresh();
    router.push("/portfolio");
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all";
  const labelClass = "text-xs text-muted-foreground font-medium";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <Building2 className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Willkommen bei <span className="text-primary">DO Crypto</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-2">
            Bitte schliesse die Kontoeröffnung ab. (Schweizer KYC-Anforderungen)
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {([1, 2, 3] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border flex-shrink-0 transition-colors ${
                s < step ? "bg-success border-success text-background"
                : s === step ? "bg-primary/20 border-primary text-primary"
                : "bg-card border-border text-muted-foreground"
              }`}>
                {s < step ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              <span className={`text-xs font-medium ${s === step ? "text-foreground" : "text-muted-foreground"}`}>
                {s === 1 ? "Persönliche Daten" : s === 2 ? "Wallet-Verifizierung" : "Abgeschlossen"}
              </span>
              {i < 2 && <div className="flex-1 h-px bg-border" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Step 1: Personal data */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass rounded-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Schritt 1: Persönliche Angaben</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Vorname *</label>
                  <input {...field("first_name")} placeholder="Max" className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Nachname *</label>
                  <input {...field("last_name")} placeholder="Mustermann" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Geburtsdatum *</label>
                  <input type="date" {...field("date_of_birth")} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Nationalität</label>
                  <select {...field("nationality")} className={inputClass}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Telefonnummer</label>
                <input {...field("phone")} placeholder="+41 79 000 00 00" className={inputClass} />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Adresse</label>
                <input {...field("address_line")} placeholder="Musterstrasse 1" className={inputClass} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>PLZ</label>
                  <input {...field("postal_code")} placeholder="8001" className={inputClass} />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <label className={labelClass}>Stadt</label>
                  <input {...field("city")} placeholder="Zürich" className={inputClass} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Land</label>
                <select {...field("country")} className={inputClass}>
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={saveProfile}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {loading ? "Speichern…" : "Weiter zur Wallet-Verifizierung"}
              </button>
            </motion.div>
          )}

          {/* Step 2: Wallet verification */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass rounded-2xl p-6 space-y-5"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                <span>Schritt 2: Wallet-Verifizierung (KYC)</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground leading-relaxed">
                Gemäss Schweizer Bankrecht (FINMA-Richtlinien) müssen wir die Kontrolle über deine Wallet-Adresse bestätigen.
                Der Satoshi-Test beweist, dass du Zugriff auf die Wallet hast — durch eine kleine On-Chain Micro-Transaktion.
              </div>

              {checkingWallet ? (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Prüfe Status…
                </div>
              ) : hasVerifiedWallet ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-success/15 border-2 border-success flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-success" />
                  </div>
                  <div>
                    <p className="font-semibold text-success">Wallet verifiziert!</p>
                    <p className="text-muted-foreground text-sm mt-1">Deine Wallet wurde erfolgreich bestätigt.</p>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2 px-6 py-3 bg-success text-background font-semibold rounded-xl hover:bg-success/90 transition-all"
                  >
                    <ChevronRight className="w-4 h-4" /> Weiter
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <a
                    href="/satoshi-test"
                    className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 transition-all text-sm"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Satoshi-Test jetzt starten
                  </a>
                  <button
                    onClick={() => setWalletRefresh(n => n + 1)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-border text-muted-foreground rounded-xl hover:text-foreground transition-all text-sm"
                  >
                    {checkingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Status aktualisieren
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 3: Complete */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass rounded-2xl p-8 flex flex-col items-center text-center gap-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-success/15 border-2 border-success flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-success" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-success">Konto aktiviert!</h2>
                <p className="text-muted-foreground text-sm mt-2">
                  Dein DO Crypto Konto wurde erfolgreich eröffnet und verifiziert.
                  Du hast jetzt vollen Zugang zum Banking-Portal.
                </p>
              </div>
              <button
                onClick={completeOnboarding}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {loading ? "Weiterleitung…" : "Zum Dashboard"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
