
-- Orcamentos table
CREATE TABLE public.orcamentos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all orcamentos" ON public.orcamentos FOR ALL USING (true) WITH CHECK (true);

-- Pedidos table
CREATE TABLE public.pedidos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);

-- Ordens de Servico table
CREATE TABLE public.ordens_servico (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all ordens_servico" ON public.ordens_servico FOR ALL USING (true) WITH CHECK (true);

-- Clientes table
CREATE TABLE public.clientes (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- Produtos table
CREATE TABLE public.produtos (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- Estoque table
CREATE TABLE public.estoque (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all estoque" ON public.estoque FOR ALL USING (true) WITH CHECK (true);

-- Metas Vendedores table
CREATE TABLE public.metas_vendedores (
  vendedor text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.metas_vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all metas_vendedores" ON public.metas_vendedores FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orcamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ordens_servico;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.produtos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.estoque;
ALTER PUBLICATION supabase_realtime ADD TABLE public.metas_vendedores;
