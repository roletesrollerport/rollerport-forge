CREATE TABLE public.fornecedores (
  id text NOT NULL PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);