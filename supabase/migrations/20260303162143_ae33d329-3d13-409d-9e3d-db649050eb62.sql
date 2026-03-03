
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
