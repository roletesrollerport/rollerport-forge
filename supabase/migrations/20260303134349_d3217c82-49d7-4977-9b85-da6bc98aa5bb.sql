
-- Tubos table
CREATE TABLE public.custos_tubos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diametro numeric NOT NULL DEFAULT 0,
  parede numeric NOT NULL DEFAULT 0,
  valor_metro numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.custos_tubos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to custos_tubos" ON public.custos_tubos FOR ALL USING (true) WITH CHECK (true);

-- Eixos table
CREATE TABLE public.custos_eixos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diametro text NOT NULL DEFAULT '',
  valor_metro numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.custos_eixos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to custos_eixos" ON public.custos_eixos FOR ALL USING (true) WITH CHECK (true);

-- Conjuntos table
CREATE TABLE public.custos_conjuntos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.custos_conjuntos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to custos_conjuntos" ON public.custos_conjuntos FOR ALL USING (true) WITH CHECK (true);

-- Revestimentos table
CREATE TABLE public.custos_revestimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT '',
  valor_metro_ou_peca numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.custos_revestimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to custos_revestimentos" ON public.custos_revestimentos FOR ALL USING (true) WITH CHECK (true);

-- Encaixes table
CREATE TABLE public.custos_encaixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT '',
  preco numeric NOT NULL DEFAULT 0,
  imagem text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.custos_encaixes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to custos_encaixes" ON public.custos_encaixes FOR ALL USING (true) WITH CHECK (true);
