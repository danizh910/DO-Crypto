-- DO Crypto – Schema Migration v3: AI Governance
-- Run in: https://supabase.com/dashboard/project/rgsdceujekdnrlmtpxph/sql/new

-- 1. Agent logs (system-wide, admin-readable only)
CREATE TABLE IF NOT EXISTS public.agent_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id    text NOT NULL,
  agent_name  text NOT NULL,
  agent_level int  NOT NULL DEFAULT 1,
  action      text NOT NULL,
  status      text NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('running', 'completed', 'error')),
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;
-- Only service role can insert/select (API routes use service role)
DROP POLICY IF EXISTS "Service role manages agent_logs" ON public.agent_logs;
CREATE POLICY "Service role manages agent_logs" ON public.agent_logs
  FOR ALL USING (false);  -- Blocked for anon/authenticated; service role bypasses RLS
