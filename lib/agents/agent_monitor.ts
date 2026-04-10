/**
 * agent_monitor.ts
 *
 * Placeholder for the DO Crypto AI transaction monitor agent.
 *
 * Future responsibilities:
 * - Read transaction data from Supabase in real time
 * - Detect anomalous patterns (large amounts, unusual timing, flagged addresses)
 * - Trigger compliance alerts and update `wallets.satoshi_status`
 * - Integrate with Claude API for natural-language summaries of wallet activity
 */

export interface MonitorEvent {
  type: "large_tx" | "satoshi_match" | "anomaly";
  walletAddress: string;
  txHash: string;
  amount: string;
  timestamp: number;
}

// TODO: implement real-time Supabase listener + Viem RPC polling
export async function startMonitor(): Promise<void> {
  console.log("[agent_monitor] Agent not yet implemented.");
}
