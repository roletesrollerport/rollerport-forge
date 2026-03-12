
-- Fix all SELECT policies to be PERMISSIVE instead of RESTRICTIVE

-- usuarios
DROP POLICY IF EXISTS "Allow public read of usuarios" ON public.usuarios;
CREATE POLICY "Allow public read of usuarios" ON public.usuarios FOR SELECT TO public USING (true);

-- clientes
DROP POLICY IF EXISTS "Allow read clientes" ON public.clientes;
CREATE POLICY "Allow read clientes" ON public.clientes FOR SELECT TO public USING (true);

-- custos_conjuntos
DROP POLICY IF EXISTS "Allow read custos_conjuntos" ON public.custos_conjuntos;
CREATE POLICY "Allow read custos_conjuntos" ON public.custos_conjuntos FOR SELECT TO public USING (true);

-- custos_eixos
DROP POLICY IF EXISTS "Allow read custos_eixos" ON public.custos_eixos;
CREATE POLICY "Allow read custos_eixos" ON public.custos_eixos FOR SELECT TO public USING (true);

-- custos_encaixes
DROP POLICY IF EXISTS "Allow read custos_encaixes" ON public.custos_encaixes;
CREATE POLICY "Allow read custos_encaixes" ON public.custos_encaixes FOR SELECT TO public USING (true);

-- custos_revestimentos
DROP POLICY IF EXISTS "Allow read custos_revestimentos" ON public.custos_revestimentos;
CREATE POLICY "Allow read custos_revestimentos" ON public.custos_revestimentos FOR SELECT TO public USING (true);

-- custos_tubos
DROP POLICY IF EXISTS "Allow read custos_tubos" ON public.custos_tubos;
CREATE POLICY "Allow read custos_tubos" ON public.custos_tubos FOR SELECT TO public USING (true);

-- estoque
DROP POLICY IF EXISTS "Allow read estoque" ON public.estoque;
CREATE POLICY "Allow read estoque" ON public.estoque FOR SELECT TO public USING (true);

-- fornecedores
DROP POLICY IF EXISTS "Allow read fornecedores" ON public.fornecedores;
CREATE POLICY "Allow read fornecedores" ON public.fornecedores FOR SELECT TO public USING (true);

-- metas_vendedores
DROP POLICY IF EXISTS "Allow read metas_vendedores" ON public.metas_vendedores;
CREATE POLICY "Allow read metas_vendedores" ON public.metas_vendedores FOR SELECT TO public USING (true);

-- orcamentos
DROP POLICY IF EXISTS "Allow read orcamentos" ON public.orcamentos;
CREATE POLICY "Allow read orcamentos" ON public.orcamentos FOR SELECT TO public USING (true);

-- ordens_servico
DROP POLICY IF EXISTS "Allow read ordens_servico" ON public.ordens_servico;
CREATE POLICY "Allow read ordens_servico" ON public.ordens_servico FOR SELECT TO public USING (true);

-- pedidos
DROP POLICY IF EXISTS "Allow read pedidos" ON public.pedidos;
CREATE POLICY "Allow read pedidos" ON public.pedidos FOR SELECT TO public USING (true);

-- produtos
DROP POLICY IF EXISTS "Allow read produtos" ON public.produtos;
CREATE POLICY "Allow read produtos" ON public.produtos FOR SELECT TO public USING (true);
