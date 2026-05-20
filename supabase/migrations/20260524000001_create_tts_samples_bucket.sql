-- tts-samples 버킷 생성 (설정 페이지 미리듣기 샘플 18개 저장용)
-- public read: 인증 없이 URL로 바로 재생 가능
-- 업로드는 service_role만 허용: 스크립트로 1회 사전 생성 후 고정 운영

INSERT INTO storage.buckets (id, name, public)
VALUES ('tts-samples', 'tts-samples', true)
ON CONFLICT (id) DO NOTHING;

-- public 읽기 정책 (anon 포함 누구나 GET 가능)
CREATE POLICY "tts_samples_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tts-samples');

-- service_role 업로드 정책 (스크립트 사전 생성 전용 — 일반 유저 업로드 불가)
CREATE POLICY "tts_samples_service_role_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tts-samples'
    AND auth.role() = 'service_role'
  );
