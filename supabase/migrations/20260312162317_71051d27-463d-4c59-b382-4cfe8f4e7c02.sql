
-- Fix: Allow authenticated users to SELECT from usuarios table
-- This is needed because usuarios_public view uses security_invoker=on
DROP POLICY IF EXISTS "usuarios_no_direct_select" ON public.usuarios;
CREATE POLICY "usuarios_allow_select" ON public.usuarios FOR SELECT TO authenticated USING (true);

-- Also allow anon to select (for login flow via view)
DROP POLICY IF EXISTS "Block direct select usuarios" ON public.usuarios;
CREATE POLICY "usuarios_anon_select" ON public.usuarios FOR SELECT TO anon USING (true);
