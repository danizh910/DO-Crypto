-- DO Crypto – Schema Migration v4
-- Run in: https://supabase.com/dashboard/project/rgsdceujekdnrlmtpxph/sql/new

-- 1. Fix staking_positions status constraint to allow "unstaked"
ALTER TABLE public.staking_positions
  DROP CONSTRAINT IF EXISTS staking_positions_status_check;

ALTER TABLE public.staking_positions
  ADD CONSTRAINT staking_positions_status_check
  CHECK (status IN ('active', 'unstaked', 'withdrawn'));

-- Ensure started_at has a default
ALTER TABLE public.staking_positions
  ALTER COLUMN started_at SET DEFAULT now();

-- 2. Allow service role to manage ai_conversations (for agent memory)
DROP POLICY IF EXISTS "Service role manages ai_conversations" ON public.ai_conversations;
CREATE POLICY "Service role manages ai_conversations" ON public.ai_conversations
  FOR ALL USING (true);

-- 3. Add swap_transactions table for token swaps
CREATE TABLE IF NOT EXISTS public.swap_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  from_token  text NOT NULL,
  to_token    text NOT NULL,
  from_amount numeric NOT NULL,
  to_amount   numeric NOT NULL,
  rate        numeric NOT NULL,
  status      text DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.swap_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own swap_transactions" ON public.swap_transactions
  FOR ALL USING (auth.uid() = user_id);

-- 4. Add purchase_transactions table for buy orders
CREATE TABLE IF NOT EXISTS public.purchase_transactions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token         text NOT NULL,
  fiat_amount   numeric NOT NULL,
  fiat_currency text DEFAULT 'CHF',
  crypto_amount numeric NOT NULL,
  rate_at_buy   numeric NOT NULL,
  status        text DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.purchase_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own purchase_transactions" ON public.purchase_transactions
  FOR ALL USING (auth.uid() = user_id);
