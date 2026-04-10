export type SatoshiStatus = "pending" | "verified" | "failed";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  satoshi_status: SatoshiStatus;
  satoshi_amount: number | null;
  verified_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  tx_hash: string;
  amount: string;
  token: string;
  chain_id: number;
  direction: "in" | "out";
  status: "pending" | "confirmed" | "failed";
  created_at: string;
}

export interface StakingPosition {
  id: string;
  user_id: string;
  protocol: string;
  token: string;
  amount: string;
  apy_at_stake: number;
  started_at: string;
  status: "active" | "unstaked";
}
