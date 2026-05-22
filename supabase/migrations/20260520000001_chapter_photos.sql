-- 챕터 사진 첨부 기능
-- chapters 테이블에 photo_url 컬럼 추가
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;

-- chapter-photos 스토리지 버킷 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chapter-photos', 'chapter-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 스토리지 정책: 인증 사용자 업로드 허용
CREATE POLICY "chapter_photos_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chapter-photos');

-- 스토리지 정책: 본인 파일 삭제 허용
CREATE POLICY "chapter_photos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chapter-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
