"use client";

import { motion } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownLeft, ShieldCheck, Coins } from "lucide-react";

const mockBalances = [
  { symbol: "ETH", name: "Ethereum", amount: "2.481", value: "$8,234.12", change: "+4.2%" },
  { symbol: "USDC", name: "USD Coin", amount: "14,320.00", value: "$14,320.00", change: "+0.01%" },
  { symbol: "cbETH", name: "Coinbase ETH", amount: "0.95", value: "$3,152.40", change: "+4.1%" },
];

const mockTransactions = [
  { type: "in", label: "Received ETH", amount: "+0.5 ETH", date: "Today, 14:32", status: "confirmed" },
  { type: "out", label: "Sent USDC", amount: "-500 USDC", date: "Today, 09:11", status: "confirmed" },
  { type: "in", label: "Staking Reward", amount: "+0.003 ETH", date: "Yesterday", status: "confirmed" },
];

const card = "glass rounded-2xl p-6";

export default function PortfolioPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <p className="text-muted-foreground text-sm mt-1">Sepolia Testnet</p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-12 gap-4">

        {/* Total Balance — wide tile */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${card} col-span-12 md:col-span-8`}
        >
          <p className="text-muted-foreground text-sm">Gesamtguthaben</p>
          <p className="text-4xl font-bold text-foreground mt-2">$22,573 <span className="text-primary">EYD</span></p>
          <div className="flex items-center gap-1 mt-2 text-success text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+3.8% diese Woche</span>
          </div>
          <button className="mt-4 bg-primary text-background text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-all">
            Start Staking
          </button>
        </motion.div>

        {/* Satoshi Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`${card} col-span-12 md:col-span-4 flex flex-col justify-between`}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Satoshi-Test</span>
          </div>
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6 text-success" />
            </div>
            <p className="text-success font-semibold mt-2 text-sm">Verified</p>
          </div>
        </motion.div>

        {/* Holdings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`${card} col-span-12 md:col-span-6`}
        >
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <Coins className="w-4 h-4" />
            <span>Bestände</span>
          </div>
          <div className="space-y-3">
            {mockBalances.map((asset) => (
              <div key={asset.symbol} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {asset.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{asset.symbol}</p>
                    <p className="text-xs text-muted-foreground">{asset.amount}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{asset.value}</p>
                  <p className="text-xs text-success">{asset.change}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Transactions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`${card} col-span-12 md:col-span-6`}
        >
          <p className="text-sm text-muted-foreground mb-4">Letzte Transaktionen</p>
          <div className="space-y-3">
            {mockTransactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    tx.type === "in" ? "bg-success/10" : "bg-destructive/10"
                  }`}>
                    {tx.type === "in"
                      ? <ArrowDownLeft className="w-4 h-4 text-success" />
                      : <ArrowUpRight className="w-4 h-4 text-destructive" />
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tx.label}</p>
                    <p className="text-xs text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
                <p className={`text-sm font-medium ${tx.type === "in" ? "text-success" : "text-destructive"}`}>
                  {tx.amount}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
