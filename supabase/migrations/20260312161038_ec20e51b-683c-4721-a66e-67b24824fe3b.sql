-- Fix linter: table with RLS enabled but no policies (sessions)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_deny_select" ON public.sessions;
CREATE POLICY "sessions_deny_select"
ON public.sessions
FOR SELECT
TO authenticated
USING (false);

DROP POLICY IF EXISTS "sessions_deny_insert" ON public.sessions;
CREATE POLICY "sessions_deny_insert"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "sessions_deny_update" ON public.sessions;
CREATE POLICY "sessions_deny_update"
ON public.sessions
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "sessions_deny_delete" ON public.sessions;
CREATE POLICY "sessions_deny_delete"
ON public.sessions
FOR DELETE
TO authenticated
USING (false);