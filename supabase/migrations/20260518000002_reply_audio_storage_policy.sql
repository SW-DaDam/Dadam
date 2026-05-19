-- reply-audio 버킷 SELECT 정책 추가
-- create_signed_reply_audio_url RPC 배포 전 클라이언트에서
-- supabase.storage.createSignedUrl() 을 직접 호출할 수 있도록 허용
-- (signed URL은 시간 제한이 있어 보안상 안전)

CREATE POLICY "reply_audio_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'reply-audio');
