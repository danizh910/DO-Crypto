-- DO Crypto – Schema Migration v2
-- Run in: https://supabase.com/dashboard/project/rgsdceujekdnrlmtpxph/sql/new

-- 1. Extend profiles with personal data + onboarding status
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name    text,
  ADD COLUMN IF NOT EXISTS last_name     text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS nationality   text,
  ADD COLUMN IF NOT EXISTS phone         text,
  ADD COLUMN IF NOT EXISTS address_line  text,
  ADD COLUMN IF NOT EXISTS postal_code   text,
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS country       text DEFAULT 'CH',
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- 2. AI conversations table (chat history = long-term memory)
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  employee_id  text NOT NULL,
  role         text NOT NULL CHECK (role IN ('user', 'assistant')),
  content      text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own ai_conversations" ON public.ai_conversations;
CREATE POLICY "Users manage own ai_conversations" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- 3. Index for fast conversation loading
CREATE INDEX IF NOT EXISTS ai_conversations_user_employee_idx
  ON public.ai_conversations (user_id, employee_id, created_at DESC);

-- 4. Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  type       text DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" ON public.notifications
  FOR ALL USING (auth.uid() = user_id);
