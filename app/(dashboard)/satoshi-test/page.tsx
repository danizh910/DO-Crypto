"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther, isAddress } from "viem";
import { createClient } from "@/lib/supabase/client";
import {
  ShieldCheck,
  AlertCircle,
  Copy,
  CheckCircle2,
  Loader2,
  Wallet,
  Zap,
  ArrowRight,
} from "lucide-react";

type Step = "input" | "challenge" | "verifying" | "verified" | "failed";

const VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`) ??
  "0x000000000000000000000000000000000000dEaD";

function generateChallengeAmount(): number {
  // Random between 0.000100 and 0.000999 ETH (8 decimal places)
  const micro = Math.floor(Math.random() * 900) + 100; // 100–999
  return micro / 1_000_000;
}

function formatChallenge(amount: number): string {
  return amount.toFixed(6);
}

export default function SatoshiTestPage() {
  const { address: connectedAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const supabase = createClient();

  const [walletInput, setWalletInput] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [challengeAmount, setChallengeAmount] = useState<number | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetAddress = walletInput || connectedAddress || "";

  async function handleGenerateChallenge() {
    setError(null);
    const addr = targetAddress.trim();
    if (!isAddress(addr)) {
      setError("Ungültige Ethereum-Adresse.");
      return;
    }

    const amount = generateChallengeAmount();
    setChallengeAmount(amount);

    // Persist wallet + challenge in Supabase
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Nicht eingeloggt.");
      return;
    }

    const { data, error: dbErr } = await supabase
      .from("wallets")
      .upsert(
        {
          user_id: user.id,
          address: addr.toLowerCase(),
          satoshi_challenge_amount: amount,
          is_verified: false,
          verified_at: null,
        },
        { onConflict: "user_id,address" }
      )
      .select("id")
      .single();

    if (dbErr || !data) {
      setError("Datenbankfehler: " + (dbErr?.message ?? "Unbekannt"));
      return;
    }
    setWalletId(data.id);
    setStep("challenge");
  }

  async function handleVerify() {
    if (!publicClient || !challengeAmount || !walletId) return;
    setStep("verifying");
    setError(null);

    try {
      const addr = targetAddress.trim() as `0x${string}`;
      const balanceWei = await publicClient.getBalance({ address: addr });
      const balanceEth = parseFloat(formatEther(balanceWei));
      const required = challengeAmount;

      if (balanceEth >= required) {
        // Mark verified in Supabase
        const { error: updateErr } = await supabase
          .from("wallets")
          .update({ is_verified: true, verified_at: new Date().toISOString() })
          .eq("id", walletId);

        if (updateErr) {
          setError("DB-Update fehlgeschlagen: " + updateErr.message);
          setStep("failed");
          return;
        }
        setStep("verified");
      } else {
        setError(
          `Guthaben zu niedrig: ${balanceEth.toFixed(6)} ETH < ${formatChallenge(required)} ETH`
        );
        setStep("failed");
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError("RPC-Fehler: " + msg);
      setStep("failed");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setStep("input");
    setChallengeAmount(null);
    setWalletId(null);
    setError(null);
    setWalletInput("");
  }

  const steps = [
    { id: "input", label: "Wallet eingeben" },
    { id: "challenge", label: "Betrag senden" },
    { id: "verified", label: "Verifiziert" },
  ];
  const currentStepIndex =
    step === "verifying" || step === "failed"
      ? 1
      : steps.findIndex((s) => s.id === step);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Satoshi-Test
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Verifiziere deine Wallet-Adresse durch eine On-Chain Micro-Transaktion
          auf dem Sepolia Testnet.
        </p>
      </motion.div>

      {/* Progress stepper */}
      <motion.div
        className="glass rounded-xl p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className="flex items-center gap-2 flex-shrink-0">
                <motion.div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border transition-colors ${
                    i < currentStepIndex
                      ? "bg-success border-success text-background"
                      : i === currentStepIndex
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                  animate={i === currentStepIndex ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  {i < currentStepIndex ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    i + 1
                  )}
                </motion.div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    i === currentStepIndex
                      ? "text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1" />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Main card */}
      <AnimatePresence mode="wait">
        {step === "input" && (
          <motion.div
            key="input"
            className="glass rounded-2xl p-6 space-y-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="w-4 h-4" />
              <span>Schritt 1: Wallet-Adresse eingeben</span>
            </div>

            {isConnected && connectedAddress && (
              <button
                onClick={() => setWalletInput(connectedAddress)}
                className="w-full text-left p-3 rounded-lg bg-primary/5 border border-primary/20 hover:border-primary/40 transition-colors group"
              >
                <div className="text-xs text-muted-foreground mb-1">
                  Verbundene Wallet verwenden
                </div>
                <div className="text-xs font-mono text-primary truncate group-hover:text-primary/80">
                  {connectedAddress}
                </div>
              </button>
            )}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">
                Wallet-Adresse (Sepolia)
              </label>
              <input
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="0x..."
                className="w-full bg-card border border-border rounded-lg px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerateChallenge}
              disabled={!targetAddress}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-primary text-background font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Zap className="w-4 h-4" />
              Challenge generieren
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {(step === "challenge" || step === "verifying" || step === "failed") && (
          <motion.div
            key="challenge"
            className="glass rounded-2xl p-6 space-y-5"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="w-4 h-4 text-secondary" />
              <span>Schritt 2: Micro-Transaktion senden</span>
            </div>

            {/* Challenge amount */}
            <div className="rounded-xl bg-secondary/10 border border-secondary/20 p-4 space-y-1">
              <div className="text-xs text-muted-foreground">
                Bitte sende exakt diesen Betrag
              </div>
              <div className="text-3xl font-bold font-mono text-secondary">
                {challengeAmount ? formatChallenge(challengeAmount) : "—"}{" "}
                <span className="text-lg font-normal text-muted-foreground">
                  Sepolia ETH
                </span>
              </div>
            </div>

            {/* Vault address */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground font-medium">
                An diese Vault-Adresse senden
              </div>
              <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-foreground truncate">
                  {VAULT_ADDRESS}
                </code>
                <button
                  onClick={() => copyToClipboard(VAULT_ADDRESS)}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2">
              {[
                "Stelle sicher, dass du das Sepolia Testnet ausgewählt hast",
                `Sende exakt ${challengeAmount ? formatChallenge(challengeAmount) : "—"} ETH — nicht mehr, nicht weniger`,
                "Warte bis die Transaktion bestätigt ist (~15 Sek.)",
                'Klicke dann auf "Verifizierung prüfen"',
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <div className="w-5 h-5 rounded-full border border-border flex items-center justify-center flex-shrink-0 mt-0.5 text-xs text-muted-foreground">
                    {i + 1}
                  </div>
                  {item}
                </motion.div>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 py-3 px-4 border border-border text-muted-foreground rounded-xl hover:border-foreground/20 hover:text-foreground transition-all text-sm"
              >
                Zurück
              </button>
              <button
                onClick={handleVerify}
                disabled={step === "verifying"}
                className="flex-[2] flex items-center justify-center gap-2 py-3 px-6 bg-success text-background font-semibold rounded-xl hover:bg-success/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              >
                {step === "verifying" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Prüfe On-Chain…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Verifizierung prüfen
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {step === "verified" && (
          <motion.div
            key="verified"
            className="glass rounded-2xl p-8 flex flex-col items-center text-center gap-5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-success/15 border-2 border-success flex items-center justify-center"
            >
              <ShieldCheck className="w-10 h-10 text-success" />
            </motion.div>

            <div>
              <h2 className="text-2xl font-bold text-success mb-1">
                Wallet verifiziert
              </h2>
              <p className="text-muted-foreground text-sm">
                Deine Wallet-Adresse wurde erfolgreich auf dem Sepolia Testnet
                bestätigt.
              </p>
            </div>

            <div className="w-full bg-success/10 border border-success/20 rounded-xl px-4 py-3">
              <code className="text-xs font-mono text-success break-all">
                {targetAddress}
              </code>
            </div>

            <button
              onClick={reset}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Weitere Wallet verifizieren
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info footer */}
      <motion.p
        className="text-xs text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        Der Satoshi-Test läuft ausschliesslich auf dem Sepolia Testnet. Es wird
        kein echtes ETH verwendet.
      </motion.p>
    </div>
  );
}
