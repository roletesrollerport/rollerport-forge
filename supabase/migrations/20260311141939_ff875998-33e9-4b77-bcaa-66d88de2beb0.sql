
-- Drop all permissive FOR ALL policies on business tables
DROP POLICY IF EXISTS "Allow all clientes" ON public.clientes;
DROP POLICY IF EXISTS "Allow all estoque" ON public.estoque;
DROP POLICY IF EXISTS "Allow all fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow all metas_vendedores" ON public.metas_vendedores;
DROP POLICY IF EXISTS "Allow all orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Allow all ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Allow all pedidos" ON public.pedidos;
DROP POLICY IF EXISTS "Allow all produtos" ON public.produtos;
DROP POLICY IF EXISTS "Allow all access to custos_tubos" ON public.custos_tubos;
DROP POLICY IF EXISTS "Allow all access to custos_eixos" ON public.custos_eixos;
DROP POLICY IF EXISTS "Allow all access to custos_conjuntos" ON public.custos_conjuntos;
DROP POLICY IF EXISTS "Allow all access to custos_revestimentos" ON public.custos_revestimentos;
DROP POLICY IF EXISTS "Allow all access to custos_encaixes" ON public.custos_encaixes;

-- Allow SELECT (reads) on all business tables
CREATE POLICY "Allow read clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "Allow read estoque" ON public.estoque FOR SELECT USING (true);
CREATE POLICY "Allow read fornecedores" ON public.fornecedores FOR SELECT USING (true);
CREATE POLICY "Allow read metas_vendedores" ON public.metas_vendedores FOR SELECT USING (true);
CREATE POLICY "Allow read orcamentos" ON public.orcamentos FOR SELECT USING (true);
CREATE POLICY "Allow read ordens_servico" ON public.ordens_servico FOR SELECT USING (true);
CREATE POLICY "Allow read pedidos" ON public.pedidos FOR SELECT USING (true);
CREATE POLICY "Allow read produtos" ON public.produtos FOR SELECT USING (true);
CREATE POLICY "Allow read custos_tubos" ON public.custos_tubos FOR SELECT USING (true);
CREATE POLICY "Allow read custos_eixos" ON public.custos_eixos FOR SELECT USING (true);
CREATE POLICY "Allow read custos_conjuntos" ON public.custos_conjuntos FOR SELECT USING (true);
CREATE POLICY "Allow read custos_revestimentos" ON public.custos_revestimentos FOR SELECT USING (true);
CREATE POLICY "Allow read custos_encaixes" ON public.custos_encaixes FOR SELECT USING (true);

-- Block INSERT on all business tables (writes go through edge function)
CREATE POLICY "Block insert clientes" ON public.clientes FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert estoque" ON public.estoque FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert fornecedores" ON public.fornecedores FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert metas_vendedores" ON public.metas_vendedores FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert orcamentos" ON public.orcamentos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert ordens_servico" ON public.ordens_servico FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert pedidos" ON public.pedidos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert produtos" ON public.produtos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert custos_tubos" ON public.custos_tubos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert custos_eixos" ON public.custos_eixos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert custos_conjuntos" ON public.custos_conjuntos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert custos_revestimentos" ON public.custos_revestimentos FOR INSERT WITH CHECK (false);
CREATE POLICY "Block insert custos_encaixes" ON public.custos_encaixes FOR INSERT WITH CHECK (false);

-- Block UPDATE on all business tables
CREATE POLICY "Block update clientes" ON public.clientes FOR UPDATE USING (false);
CREATE POLICY "Block update estoque" ON public.estoque FOR UPDATE USING (false);
CREATE POLICY "Block update fornecedores" ON public.fornecedores FOR UPDATE USING (false);
CREATE POLICY "Block update metas_vendedores" ON public.metas_vendedores FOR UPDATE USING (false);
CREATE POLICY "Block update orcamentos" ON public.orcamentos FOR UPDATE USING (false);
CREATE POLICY "Block update ordens_servico" ON public.ordens_servico FOR UPDATE USING (false);
CREATE POLICY "Block update pedidos" ON public.pedidos FOR UPDATE USING (false);
CREATE POLICY "Block update produtos" ON public.produtos FOR UPDATE USING (false);
CREATE POLICY "Block update custos_tubos" ON public.custos_tubos FOR UPDATE USING (false);
CREATE POLICY "Block update custos_eixos" ON public.custos_eixos FOR UPDATE USING (false);
CREATE POLICY "Block update custos_conjuntos" ON public.custos_conjuntos FOR UPDATE USING (false);
CREATE POLICY "Block update custos_revestimentos" ON public.custos_revestimentos FOR UPDATE USING (false);
CREATE POLICY "Block update custos_encaixes" ON public.custos_encaixes FOR UPDATE USING (false);

-- Block DELETE on all business tables
CREATE POLICY "Block delete clientes" ON public.clientes FOR DELETE USING (false);
CREATE POLICY "Block delete estoque" ON public.estoque FOR DELETE USING (false);
CREATE POLICY "Block delete fornecedores" ON public.fornecedores FOR DELETE USING (false);
CREATE POLICY "Block delete metas_vendedores" ON public.metas_vendedores FOR DELETE USING (false);
CREATE POLICY "Block delete orcamentos" ON public.orcamentos FOR DELETE USING (false);
CREATE POLICY "Block delete ordens_servico" ON public.ordens_servico FOR DELETE USING (false);
CREATE POLICY "Block delete pedidos" ON public.pedidos FOR DELETE USING (false);
CREATE POLICY "Block delete produtos" ON public.produtos FOR DELETE USING (false);
CREATE POLICY "Block delete custos_tubos" ON public.custos_tubos FOR DELETE USING (false);
CREATE POLICY "Block delete custos_eixos" ON public.custos_eixos FOR DELETE USING (false);
CREATE POLICY "Block delete custos_conjuntos" ON public.custos_conjuntos FOR DELETE USING (false);
CREATE POLICY "Block delete custos_revestimentos" ON public.custos_revestimentos FOR DELETE USING (false);
CREATE POLICY "Block delete custos_encaixes" ON public.custos_encaixes FOR DELETE USING (false);
