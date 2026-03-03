
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
