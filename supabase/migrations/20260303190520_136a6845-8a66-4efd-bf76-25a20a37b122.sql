-- Add last_seen column to usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Enable realtime for sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- Enable realtime for usuarios table (for last_seen updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;