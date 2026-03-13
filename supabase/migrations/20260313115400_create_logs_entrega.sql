-- Create the logs_entrega table
CREATE TABLE IF NOT EXISTS public.logs_entrega (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL,
  vendedor TEXT NOT NULL,
  acao TEXT NOT NULL, -- 'ENTREGUE', 'REVERTIDO'
  valor NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.logs_entrega ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable insert for authenticated users only" ON "public"."logs_entrega"
AS PERMISSIVE FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON "public"."logs_entrega"
AS PERMISSIVE FOR SELECT
TO public
USING (true);
