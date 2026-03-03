
-- Create sessions table for server-side session management
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS and lock it down completely (only edge functions with service role can access)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no access via anon key. Only service_role can read/write.

-- Lock down chat_messages writes: drop the permissive ALL policy and replace with restrictive ones
DROP POLICY IF EXISTS "Allow all access to chat_messages" ON public.chat_messages;

-- Allow SELECT for realtime to work (read-only)
CREATE POLICY "Allow read chat_messages" ON public.chat_messages
  FOR SELECT USING (true);

-- Block all direct INSERT/UPDATE/DELETE via anon key
-- Writes will go through edge function with service_role
CREATE POLICY "Block direct insert chat_messages" ON public.chat_messages
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Block direct update chat_messages" ON public.chat_messages
  FOR UPDATE USING (false);

CREATE POLICY "Block direct delete chat_messages" ON public.chat_messages
  FOR DELETE USING (false);

-- Index for session lookups
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);
