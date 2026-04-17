"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";
import { createClient } from "@/lib/supabase/client";
import {
  User, ShieldCheck, CheckCircle2, Loader2, ChevronRight,
  AlertCircle, Building2, Wallet, MessageSquare, Copy, RefreshCw,
  Send,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const COUNTRIES = [
  { code: "CH", name: "Schweiz" }, { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" }, { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" }, { code: "US", name: "USA" },
  { code: "GB", name: "Vereinigtes Königreich" }, { code: "LI", name: "Liechtenstein" },
];

const VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`) ??
  "0x141085723f8836c3f04e8e658737562fFF46c033";

interface ChatMsg { role: "agent" | "user"; text: string }

export default function OnboardingPage() {
  const router = useRouter();
  const { address: walletAddress, isConnected } = useAccount();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — wallet save
  const [walletSaved, setWalletSaved] = useState(false);

  // Step 2 — profile form
  const [form, setForm] = useState({
    first_name: "", last_name: "", date_of_birth: "",
    nationality: "CH", phone: "", address_line: "",
    postal_code: "", city: "", country: "CH",
  });

  // Step 3 — Satoshi test
  const [challengeAmount, setChallengeAmount] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string>("");
  const [satoshiVerified, setSatoshiVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Step 4 — KI-Interview
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [interviewAnswer, setInterviewAnswer] = useState("");
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewPassed, setInterviewPassed] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  function field(name: keyof typeof form) {
    return {
      value: form[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(f => ({ ...f, [name]: e.target.value })),
    };
  }

  // ── Step 1: save wallet address to DB when connected ────────────────────────
  useEffect(() => {
    if (step !== 1 || !isConnected || !walletAddress || walletSaved) return;
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      await supabase.from("wallets").upsert(
        { user_id: user.id, address: walletAddress.toLowerCase(), is_verified: false },
        { onConflict: "user_id,address" }
      );
      setWalletSaved(true);
    });
  }, [isConnected, walletAddress, walletSaved, step]);

  // ── Step 3: generate challenge when entering step ───────────────────────────
  const generateChallenge = useCallback(async () => {
    if (!walletAddress) return;
    setError(null);
    try {
      const res = await fetch("/api/kyc/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fehler"); return; }
      setChallengeAmount(data.challengeAmount);
      setWalletId(data.walletId);
    } catch {
      setError("Netzwerkfehler");
    }
  }, [walletAddress]);

  useEffect(() => {
    if (step === 3 && !challengeAmount) {
      generateChallenge();
    }
  }, [step, challengeAmount, generateChallenge]);

  // Auto-poll for verification every 15 seconds while on step 3
  const checkVerification = useCallback(async () => {
    if (!walletAddress || !walletId || satoshiVerified) return;
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/kyc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress, walletId }),
      });
      const data = await res.json();
      if (data.verified) {
        setSatoshiVerified(true);
        setVerifyMessage("Wallet erfolgreich verifiziert!");
        if (pollingRef.current) clearInterval(pollingRef.current);
      } else {
        setVerifyMessage(data.message ?? "Noch keine Transaktion gefunden");
      }
    } catch {
      setVerifyMessage("Prüfung fehlgeschlagen — erneut versuchen");
    }
    setVerifyLoading(false);
  }, [walletAddress, walletId, satoshiVerified]);

  useEffect(() => {
    if (step !== 3 || satoshiVerified) return;
    pollingRef.current = setInterval(checkVerification, 15000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step, satoshiVerified, checkVerification]);

  // ── Step 4: start interview ──────────────────────────────────────────────────
  const startInterview = useCallback(async () => {
    setInterviewLoading(true);
    try {
      const res = await fetch("/api/kyc/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: 0 }),
      });
      const data = await res.json();
      setChat([
        { role: "agent", text: (data.greeting ?? "") + data.question },
      ]);
      setCurrentQuestionIndex(0);
    } catch { /* silent */ }
    setInterviewLoading(false);
  }, []);

  useEffect(() => {
    if (step === 4 && chat.length === 0) {
      startInterview();
    }
  }, [step, chat.length, startInterview]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ── Profile save ─────────────────────────────────────────────────────────────
  async function saveProfile() {
    if (!form.first_name || !form.last_name || !form.date_of_birth) {
      setError("Bitte fülle alle Pflichtfelder aus."); return;
    }
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { error: dbErr } = await supabase.from("profiles").update({ ...form }).eq("id", user.id);
    if (dbErr) { setError(dbErr.message); setLoading(false); return; }
    setStep(3);
    setLoading(false);
  }

  // ── Interview submit ──────────────────────────────────────────────────────────
  async function submitAnswer() {
    const ans = interviewAnswer.trim();
    if (!ans || interviewLoading) return;
    setInterviewAnswer("");
    setChat(c => [...c, { role: "user", text: ans }]);
    setInterviewLoading(true);
    try {
      const res = await fetch("/api/kyc/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionIndex: currentQuestionIndex, answer: ans }),
      });
      const data = await res.json();
      if (data.passed) {
        setChat(c => [...c, { role: "agent", text: data.feedback }]);
        setInterviewPassed(true);
      } else if (data.correct) {
        setCurrentQuestionIndex(data.nextQuestionIndex);
        setChat(c => [...c, { role: "agent", text: `${data.feedback}\n\n${data.nextQuestion}` }]);
      } else {
        setWrongAttempts(n => n + 1);
        setChat(c => [...c, { role: "agent", text: data.feedback }]);
      }
    } catch {
      setChat(c => [...c, { role: "agent", text: "Fehler — bitte erneut versuchen." }]);
    }
    setInterviewLoading(false);
  }

  // ── Complete onboarding ───────────────────────────────────────────────────────
  async function completeOnboarding() {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
    await supabase.auth.updateUser({ data: { onboarding_complete: true } });
    await supabase.auth.refreshSession();
    router.refresh();
    router.push("/portfolio");
  }

  const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all";
  const labelClass = "text-xs text-muted-foreground font-medium";

  const STEP_LABELS: Record<Step, string> = {
    1: "Wallet verbinden",
    2: "Persönliche Daten",
    3: "Satoshi-Test",
    4: "KI-Interview",
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl">

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
        <div className="flex items-center gap-1 mb-8 overflow-x-auto">
          {([1, 2, 3, 4] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border flex-shrink-0 transition-colors ${
                s < step ? "bg-success border-success text-background"
                : s === step ? "bg-primary/20 border-primary text-primary"
                : "bg-card border-border text-muted-foreground"
              }`}>
                {s < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
              </div>
              <span className={`text-xs font-medium truncate ${s === step ? "text-foreground" : "text-muted-foreground"}`}>
                {STEP_LABELS[s]}
              </span>
              {i < 3 && <div className="flex-1 h-px bg-border min-w-[8px]" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Connect wallet ──────────────────────────────────── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="w-4 h-4" />
                <span>Schritt 1: Wallet verbinden</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground leading-relaxed">
                Verbinde deine Ethereum-Wallet (Sepolia Testnet). Diese Adresse wird für den
                Satoshi-Test zur Identitätsprüfung verwendet.
              </div>

              <div className="flex justify-center py-2">
                <ConnectKitButton />
              </div>

              {isConnected && walletAddress && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-success/10 border border-success/20 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-success">Wallet verbunden</p>
                    <p className="text-xs font-mono text-muted-foreground mt-1 break-all">{walletAddress}</p>
                  </div>
                </motion.div>
              )}

              {!isConnected && (
                <p className="text-xs text-muted-foreground text-center">
                  Noch keine Wallet? Hol dir Testnet ETH auf{" "}
                  <span className="text-primary">sepoliafaucet.com</span>
                </p>
              )}

              <button
                onClick={() => { setError(null); setStep(2); }}
                disabled={!isConnected}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
                Weiter
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Personal data ───────────────────────────────────── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                <span>Schritt 2: Persönliche Angaben</span>
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

              <button onClick={saveProfile} disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                {loading ? "Speichern…" : "Weiter zum Satoshi-Test"}
              </button>
            </motion.div>
          )}

          {/* ── Step 3: Satoshi test ────────────────────────────────────── */}
          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="glass rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4" />
                <span>Schritt 3: Satoshi-Test (Wallet-Verifikation)</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-sm text-muted-foreground leading-relaxed">
                Gemäss FINMA-Richtlinien bestätigen wir deine Wallet-Kontrolle durch eine
                kleine On-Chain Micro-Transaktion auf Sepolia Testnet.
              </div>

              {!challengeAmount ? (
                <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Challenge wird generiert…
                </div>
              ) : (
                <>
                  {/* Challenge amount */}
                  <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-4 space-y-1">
                    <p className="text-xs text-muted-foreground">Sende exakt diesen Betrag</p>
                    <p className="text-3xl font-bold font-mono text-secondary">
                      {challengeAmount}{" "}
                      <span className="text-lg font-normal text-muted-foreground">Sepolia ETH</span>
                    </p>
                  </div>

                  {/* Vault address */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">An diese Vault-Adresse senden</p>
                    <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2.5">
                      <code className="flex-1 text-xs font-mono text-foreground truncate">{VAULT_ADDRESS}</code>
                      <button onClick={() => { navigator.clipboard.writeText(VAULT_ADDRESS); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* From address */}
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Von deiner Wallet senden</p>
                    <div className="bg-card border border-border rounded-xl px-3 py-2.5">
                      <code className="text-xs font-mono text-primary truncate block">{walletAddress}</code>
                    </div>
                  </div>

                  {verifyMessage && (
                    <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 ${
                      satoshiVerified
                        ? "bg-success/10 border border-success/20 text-success"
                        : "bg-white/5 border border-white/10 text-muted-foreground"
                    }`}>
                      {satoshiVerified
                        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                        : <RefreshCw className="w-4 h-4 shrink-0" />}
                      {verifyMessage}
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2.5">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  {satoshiVerified ? (
                    <button onClick={() => setStep(4)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-success text-background font-semibold rounded-xl hover:bg-success/90 transition-all">
                      <ChevronRight className="w-4 h-4" />
                      Weiter zum KI-Interview
                    </button>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={checkVerification}
                        disabled={verifyLoading || !walletId}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-all text-sm"
                      >
                        {verifyLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Prüfe…</>
                          : <><ShieldCheck className="w-4 h-4" /> Verifizierung prüfen</>}
                      </button>
                      <button
                        onClick={generateChallenge}
                        className="px-4 py-3 border border-border text-muted-foreground rounded-xl hover:text-foreground transition-all text-sm"
                        title="Neuen Challenge generieren"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    Automatische Prüfung alle 15 Sekunden · Nur Sepolia Testnet
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* ── Step 4: KI-Interview ────────────────────────────────────── */}
          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4" />
                <span>Schritt 4: KI-Compliance-Interview</span>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-xs text-muted-foreground">
                Unser KI-Compliance-Berater stellt dir drei kurze Identifikationsfragen.
                Beantworte sie anhand deiner eingegebenen Daten.
              </div>

              {/* Chat */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex flex-col gap-3 p-4 h-64 overflow-y-auto">
                  {chat.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {chat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "agent" && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary mr-2 shrink-0 mt-0.5">
                          KI
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary/15 text-foreground"
                          : "bg-white/5 text-foreground"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {interviewLoading && (
                    <div className="flex justify-start">
                      <div className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary mr-2 shrink-0">
                        KI
                      </div>
                      <div className="bg-white/5 rounded-xl px-3 py-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {!interviewPassed && (
                  <div className="border-t border-white/5 p-3">
                    <div className="flex gap-2">
                      <input
                        value={interviewAnswer}
                        onChange={(e) => setInterviewAnswer(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                        placeholder="Ihre Antwort…"
                        disabled={interviewLoading || chat.length === 0}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                      />
                      <button onClick={submitAnswer} disabled={interviewLoading || !interviewAnswer.trim() || chat.length === 0}
                        className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 disabled:opacity-40 transition-colors">
                        {interviewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {wrongAttempts >= 2 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Tipp: Verwende die genauen Angaben aus Schritt 2.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {interviewPassed && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  onClick={completeOnboarding}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-success text-background font-semibold rounded-xl hover:bg-success/90 disabled:opacity-60 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {loading ? "Weiterleitung…" : "Konto aktivieren & zum Dashboard"}
                </motion.button>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
