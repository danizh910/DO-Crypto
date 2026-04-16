"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { QrCode, Copy, CheckCircle2, Wallet, AlertCircle } from "lucide-react";
import QRCode from "react-qr-code";
import Link from "next/link";

export default function ReceivePage() {
  const { address, isConnected } = useAccount();
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Empfangen</h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Teile deine Wallet-Adresse um Sepolia ETH zu empfangen.
        </p>
      </motion.div>

      {!isConnected ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Keine Wallet verbunden</p>
            <p className="text-muted-foreground text-sm mt-1">
              Verbinde eine Wallet um deine Empfangsadresse zu sehen.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-8 flex flex-col items-center gap-6"
        >
          {/* QR Code */}
          <div className="p-4 bg-white rounded-2xl shadow-lg">
            <QRCode
              value={address ?? ""}
              size={200}
              bgColor="#ffffff"
              fgColor="#020617"
              level="M"
            />
          </div>

          {/* Network badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary text-xs font-medium">Sepolia Testnet</span>
          </div>

          {/* Address */}
          <div className="w-full space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">Wallet-Adresse</p>
            <div
              onClick={copy}
              className="cursor-pointer flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/30 transition-colors group"
            >
              <Wallet className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <code className="flex-1 text-xs font-mono text-foreground break-all">{address}</code>
              <div className="flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors">
                {copied
                  ? <CheckCircle2 className="w-4 h-4 text-success" />
                  : <Copy className="w-4 h-4" />
                }
              </div>
            </div>
            {copied && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-xs text-success"
              >
                Adresse kopiert!
              </motion.p>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Nur Sepolia Testnet ETH senden — kein echtes Kapital.
          </p>
        </motion.div>
      )}

      <div className="text-center">
        <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Zurück zum Portfolio
        </Link>
      </div>
    </div>
  );
}
