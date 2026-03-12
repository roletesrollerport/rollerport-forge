-- Security-first access fix to restore app loading on external hosting
-- 1) Safe read surface for usuarios (hide senha)
CREATE OR REPLACE VIEW public.usuarios_public
WITH (security_invoker=on) AS
SELECT
  id,
  nome,
  email,
  telefone,
  whatsapp,
  login,
  nivel,
  genero,
  ativo,
  foto,
  permissoes,
  created_at,
  auth_id,
  last_seen
FROM public.usuarios;

-- 2) Ensure base table is not directly readable by clients
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_no_direct_select" ON public.usuarios;
CREATE POLICY "usuarios_no_direct_select"
ON public.usuarios
FOR SELECT
TO authenticated
USING (false);

-- Keep user management writable for authenticated app users
DROP POLICY IF EXISTS "usuarios_authenticated_insert" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_insert"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_authenticated_update" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_update"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "usuarios_authenticated_delete" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_delete"
ON public.usuarios
FOR DELETE
TO authenticated
USING (true);

-- Privileges for usuarios: no direct SELECT, only view SELECT
REVOKE ALL ON TABLE public.usuarios FROM anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.usuarios TO authenticated;
GRANT SELECT ON TABLE public.usuarios_public TO authenticated;

-- 3) Restore authenticated access for business tables used by UI + DataSync
DO $$
DECLARE
  t text;
  business_tables text[] := ARRAY[
    'clientes',
    'fornecedores',
    'produtos',
    'estoque',
    'orcamentos',
    'pedidos',
    'ordens_servico',
    'metas_vendedores',
    'custos_tubos',
    'custos_eixos',
    'custos_conjuntos',
    'custos_revestimentos',
    'custos_encaixes'
  ];
BEGIN
  FOREACH t IN ARRAY business_tables
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'authenticated_read', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', 'authenticated_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', 'authenticated_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (true)', 'authenticated_delete', t);
  END LOOP;
END $$;