
-- Messages table for internal chat
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'audio', 'file')),
  file_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  audio_duration INTEGER,
  deleted_for_sender BOOLEAN NOT NULL DEFAULT false,
  deleted_for_all BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast conversation lookup
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages (sender_id, receiver_id, created_at DESC);
CREATE INDEX idx_chat_messages_receiver ON public.chat_messages (receiver_id, created_at DESC);

-- Enable RLS (permissive since auth is app-level, not Supabase Auth)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Allow all operations (auth is handled at app level with custom login system)
CREATE POLICY "Allow all access to chat_messages"
  ON public.chat_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Storage bucket for chat files and audio
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true);

-- Storage policies
CREATE POLICY "Anyone can upload chat files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "Anyone can read chat files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

CREATE POLICY "Anyone can delete chat files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-files');

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

-- Make chat-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-files';

-- Drop existing permissive storage policies if any
DROP POLICY IF EXISTS "Allow public access to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated access to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01_0" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01_1" ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder 1oj01_2" ON storage.objects;

-- Allow anyone to upload to chat-files (since we use custom auth, not supabase auth)
CREATE POLICY "Allow insert to chat-files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-files');

-- Allow anyone to read from chat-files (access controlled at app level)
CREATE POLICY "Allow select from chat-files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files');

-- Prevent deletion of files
CREATE POLICY "Prevent deletion of chat-files"
  ON storage.objects FOR DELETE
  USING (false);

-- Create sessions table for server-side session management
CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS and lock it down completely (only edge functions with service role can access)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies = no access via anon key. Only service_role can read/write.

-- Lock down chat_messages writes: drop the permissive ALL policy and replace with restrictive ones
DROP POLICY IF EXISTS "Allow all access to chat_messages" ON public.chat_messages;

-- Allow SELECT for realtime to work (read-only)
CREATE POLICY "Allow read chat_messages" ON public.chat_messages
  FOR SELECT USING (true);

-- Block all direct INSERT/UPDATE/DELETE via anon key
-- Writes will go through edge function with service_role
CREATE POLICY "Block direct insert chat_messages" ON public.chat_messages
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Block direct update chat_messages" ON public.chat_messages
  FOR UPDATE USING (false);

CREATE POLICY "Block direct delete chat_messages" ON public.chat_messages
  FOR DELETE USING (false);

-- Index for session lookups
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON public.sessions(expires_at);

-- Lock down usuarios table: block all direct writes
DROP POLICY IF EXISTS "Allow all insert on usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow all update on usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Allow all delete on usuarios" ON public.usuarios;

CREATE POLICY "Block direct insert usuarios" ON public.usuarios FOR INSERT WITH CHECK (false);
CREATE POLICY "Block direct update usuarios" ON public.usuarios FOR UPDATE USING (false);
CREATE POLICY "Block direct delete usuarios" ON public.usuarios FOR DELETE USING (false);

-- Lock down chat-files storage: block all direct access
DROP POLICY IF EXISTS "Allow insert to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow select from chat-files" ON storage.objects;

CREATE POLICY "Block all chat-files insert" ON storage.objects FOR INSERT WITH CHECK (false);
CREATE POLICY "Block all chat-files select" ON storage.objects FOR SELECT USING (false);
-- Add last_seen column to usuarios
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS last_seen timestamp with time zone DEFAULT now();

-- Enable realtime for sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- Enable realtime for usuarios table (for last_seen updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuarios;
-- Allow reading sessions (needed for online status detection)
CREATE POLICY "Allow read sessions" ON public.sessions
FOR SELECT USING (true);

-- Allow anonymous to delete own sessions (for logout)
CREATE POLICY "Allow delete sessions" ON public.sessions
FOR DELETE USING (true);

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

-- Add preco_barra_6000mm column to custos_tubos, convert existing data, then drop valor_metro
ALTER TABLE public.custos_tubos ADD COLUMN preco_barra_6000mm numeric NOT NULL DEFAULT 0;
UPDATE public.custos_tubos SET preco_barra_6000mm = valor_metro * 6;
ALTER TABLE public.custos_tubos DROP COLUMN valor_metro;

-- Add preco_barra_6000mm column to custos_eixos, convert existing data, then drop valor_metro
ALTER TABLE public.custos_eixos ADD COLUMN preco_barra_6000mm numeric NOT NULL DEFAULT 0;
UPDATE public.custos_eixos SET preco_barra_6000mm = valor_metro * 6;
ALTER TABLE public.custos_eixos DROP COLUMN valor_metro;

CREATE TABLE IF NOT EXISTS "public"."password_resets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "used" boolean DEFAULT false,
    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE
);

ALTER TABLE "public"."password_resets" ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS "idx_password_resets_code" ON "public"."password_resets" USING "btree" ("code");
CREATE INDEX IF NOT EXISTS "idx_password_resets_user_id" ON "public"."password_resets" USING "btree" ("user_id");

-- Grant permissions (Edge Functions use service_role usually, but good to have)
GRANT ALL ON TABLE "public"."password_resets" TO "service_role";
GRANT ALL ON TABLE "public"."password_resets" TO "postgres";
CREATE TABLE public.fornecedores (
  id text NOT NULL PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all fornecedores" ON public.fornecedores FOR ALL USING (true) WITH CHECK (true);

-- Fix: Drop restrictive SELECT policy and recreate as permissive for usuarios
DROP POLICY IF EXISTS "Allow public read of usuarios" ON public.usuarios;
CREATE POLICY "Allow public read of usuarios" ON public.usuarios FOR SELECT USING (true);

-- Fix same issue for all other tables that have restrictive SELECT policies
DROP POLICY IF EXISTS "Allow read clientes" ON public.clientes;
CREATE POLICY "Allow read clientes" ON public.clientes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read estoque" ON public.estoque;
CREATE POLICY "Allow read estoque" ON public.estoque FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read fornecedores" ON public.fornecedores;
CREATE POLICY "Allow read fornecedores" ON public.fornecedores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read metas_vendedores" ON public.metas_vendedores;
CREATE POLICY "Allow read metas_vendedores" ON public.metas_vendedores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read orcamentos" ON public.orcamentos;
CREATE POLICY "Allow read orcamentos" ON public.orcamentos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read ordens_servico" ON public.ordens_servico;
CREATE POLICY "Allow read ordens_servico" ON public.ordens_servico FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read pedidos" ON public.pedidos;
CREATE POLICY "Allow read pedidos" ON public.pedidos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read produtos" ON public.produtos;
CREATE POLICY "Allow read produtos" ON public.produtos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read custos_conjuntos" ON public.custos_conjuntos;
CREATE POLICY "Allow read custos_conjuntos" ON public.custos_conjuntos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read custos_eixos" ON public.custos_eixos;
CREATE POLICY "Allow read custos_eixos" ON public.custos_eixos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read custos_encaixes" ON public.custos_encaixes;
CREATE POLICY "Allow read custos_encaixes" ON public.custos_encaixes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read custos_revestimentos" ON public.custos_revestimentos;
CREATE POLICY "Allow read custos_revestimentos" ON public.custos_revestimentos FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow read custos_tubos" ON public.custos_tubos;
CREATE POLICY "Allow read custos_tubos" ON public.custos_tubos FOR SELECT USING (true);
