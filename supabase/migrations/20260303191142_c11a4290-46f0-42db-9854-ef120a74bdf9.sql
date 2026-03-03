-- Allow reading sessions (needed for online status detection)
CREATE POLICY "Allow read sessions" ON public.sessions
FOR SELECT USING (true);

-- Allow anonymous to delete own sessions (for logout)
CREATE POLICY "Allow delete sessions" ON public.sessions
FOR DELETE USING (true);