-- Create a table for AI and Technical Settings
CREATE TABLE IF NOT EXISTS public.ia_settings (
    key_name TEXT PRIMARY KEY,
    key_value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.ia_settings ENABLE ROW LEVEL SECURITY;

-- Allow Master users to manage settings
-- Note: Replace 'master' with the actual role name used in your 'usuarios' table if different
CREATE POLICY "Allow Master to manage settings" ON public.ia_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios
            WHERE usuarios.id = auth.uid()
            AND usuarios.nivel = 'master'
        )
    );

-- Allow all authenticated users to read settings (for backend processing)
-- In a real production environment, you would restrict reading 'keys' 
-- to service_role only or use Edge Function secrets.
CREATE POLICY "Allow authenticated users to read settings" ON public.ia_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Seed initial technical configuration
INSERT INTO public.ia_settings (key_name, key_value)
VALUES 
('markup_padrao', '1.8'),
('preco_aco_kg', '7.50'),
('openai_model_default', 'gpt-4o')
ON CONFLICT (key_name) DO NOTHING;
