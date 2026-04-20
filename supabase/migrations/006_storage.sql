-- ============================================================
-- 006_storage.sql — Storage 버킷 생성 및 정책
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',     'avatars',     true,  5242880,  ARRAY['image/jpeg','image/png','image/webp']),
  ('book-covers', 'book-covers', true,  10485760, ARRAY['image/jpeg','image/png','image/webp']),
  ('reply-audio', 'reply-audio', false, 52428800, ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg'])
ON CONFLICT (id) DO NOTHING;

-- avatars 정책
CREATE POLICY "avatar_upload_own"  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar_update_own"  ON storage.objects FOR UPDATE TO authenticated USING    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar_delete_own"  ON storage.objects FOR DELETE TO authenticated USING    (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatar_read_public" ON storage.objects FOR SELECT TO public        USING    (bucket_id = 'avatars');

-- book-covers 정책
CREATE POLICY "book_cover_read_authenticated" ON storage.objects FOR SELECT TO authenticated USING    (bucket_id = 'book-covers');
CREATE POLICY "book_cover_upload"             ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'book-covers' AND public.get_user_role() = 'senior');
CREATE POLICY "book_cover_update"             ON storage.objects FOR UPDATE TO authenticated USING    (bucket_id = 'book-covers' AND public.get_user_role() = 'senior');

-- reply-audio 정책
-- SELECT 정책 없음: signed URL(create_signed_reply_audio_url RPC)로만 접근
CREATE POLICY "reply_audio_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reply-audio' AND public.get_user_role() = 'senior');
