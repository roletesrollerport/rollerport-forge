
-- Create usuarios table
CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  telefone text DEFAULT '',
  whatsapp text DEFAULT '',
  login text NOT NULL,
  senha text NOT NULL,
  nivel text NOT NULL DEFAULT 'vendedor',
  genero text,
  ativo boolean NOT NULL DEFAULT true,
  foto text,
  permissoes jsonb DEFAULT '{"ver":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"],"editar":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"]}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read usuarios (needed for login)
CREATE POLICY "Allow public read of usuarios"
ON public.usuarios
FOR SELECT
USING (true);

-- Allow all operations (managed by app-level master check)
CREATE POLICY "Allow all insert on usuarios"
ON public.usuarios
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow all update on usuarios"
ON public.usuarios
FOR UPDATE
USING (true);

CREATE POLICY "Allow all delete on usuarios"
ON public.usuarios
FOR DELETE
USING (true);

-- Insert seed users
INSERT INTO public.usuarios (nome, email, telefone, whatsapp, login, senha, nivel, ativo, permissoes)
VALUES 
  ('Sistema Rollerport', 'gerente@rollerport.com.br', '(11) 4441-3572', '(11) 94441-3572', 'Gerente De sistema', 'Port@38610', 'master', true, '{"ver":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"],"editar":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"]}'),
  ('Paulo Vendas', 'paulo@rollerport.com.br', '', '', 'paulo', '123456', 'vendedor', true, '{"ver":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"],"editar":["inicio","custos","clientes","produtos","orcamentos","pedidos","producao","estoque","chat","ia","usuarios"]}');
