export interface Profile {
  id: string;
  email: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  address: string;
  satoshi_challenge_amount: number | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string | null;
  tx_hash: string | null;
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
