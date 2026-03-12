-- Tighten write policies created in previous migration (avoid always-true write policies)
DROP POLICY IF EXISTS "usuarios_authenticated_insert" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_insert"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_authenticated_update" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_update"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "usuarios_authenticated_delete" ON public.usuarios;
CREATE POLICY "usuarios_authenticated_delete"
ON public.usuarios
FOR DELETE
TO authenticated
USING (auth.uid() IS NOT NULL);

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
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', 'authenticated_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', 'authenticated_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'authenticated_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)', 'authenticated_delete', t);
  END LOOP;
END $$;