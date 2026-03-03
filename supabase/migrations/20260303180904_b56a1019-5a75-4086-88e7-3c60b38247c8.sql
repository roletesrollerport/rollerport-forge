
-- Lock down usuarios table: block all direct writes
DROP POLICY IF EXISTS "Allow all insert on usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow all update on usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow all delete on usuarios" ON public.usuarios;

CREATE POLICY "Block direct insert usuarios" ON public.usuarios FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct update usuarios" ON public.usuarios FOR UPDATE USING (false);
CREATE POLICY "Block direct delete usuarios" ON public.usuarios FOR DELETE USING (false);

-- Lock down chat-files storage: block all direct access
DROP POLICY IF EXISTS "Allow insert to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow select from chat-files" ON storage.objects;

CREATE POLICY "Block all chat-files insert" ON storage.objects FOR INSERT WITH CHECK (false);
CREATE POLICY "Block all chat-files select" ON storage.objects FOR SELECT USING (false);
