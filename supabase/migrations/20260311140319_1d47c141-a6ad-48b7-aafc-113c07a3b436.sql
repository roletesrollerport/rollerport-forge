
-- Fix 1: Prevent anon/authenticated from reading senha column on usuarios
REVOKE SELECT ON public.usuarios FROM anon, authenticated;
GRANT SELECT (id, nome, email, telefone, whatsapp, login, nivel, genero, ativo, foto, permissoes, created_at, last_seen) ON public.usuarios TO anon, authenticated;

-- Fix 2: Block direct SELECT on chat_messages (reads now go through edge function)
DROP POLICY IF EXISTS "Allow read chat_messages" ON public.chat_messages;
