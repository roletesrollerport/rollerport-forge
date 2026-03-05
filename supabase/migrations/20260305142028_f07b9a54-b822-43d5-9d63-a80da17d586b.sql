
-- Add preco_barra_6000mm column to custos_tubos, convert existing data, then drop valor_metro
ALTER TABLE public.custos_tubos ADD COLUMN preco_barra_6000mm numeric NOT NULL DEFAULT 0;
UPDATE public.custos_tubos SET preco_barra_6000mm = valor_metro * 6;
ALTER TABLE public.custos_tubos DROP COLUMN valor_metro;

-- Add preco_barra_6000mm column to custos_eixos, convert existing data, then drop valor_metro
ALTER TABLE public.custos_eixos ADD COLUMN preco_barra_6000mm numeric NOT NULL DEFAULT 0;
UPDATE public.custos_eixos SET preco_barra_6000mm = valor_metro * 6;
ALTER TABLE public.custos_eixos DROP COLUMN valor_metro;
