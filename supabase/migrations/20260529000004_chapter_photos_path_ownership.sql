-- ============================================================
-- 20260529000004_chapter_photos_path_ownership.sql
-- 보안 수정(P2-6): chapter-photos 버킷 업로드/접근 경로 소유권 제한
--
-- [문제 — 원격 DB 실제 상태]
-- 원격에는 마이그레이션 파일과 달리 `chapter_photos_all` 정책이 존재한다:
--   FOR ALL TO authenticated  USING/CHECK (bucket_id = 'chapter-photos')
-- → 인증 사용자라면 누구나 임의 경로에 업로드뿐 아니라 타인 사진을 UPDATE/DELETE 까지
--   가능한 상태(경로 소유권 검증 전무). public 버킷이라 콘텐츠 오염 위험도 큼.
--
-- [수정]
-- 경로 규칙은 `{auth.uid()}/{chapterId}.{ext}` (BookEditPage.tsx). 이를 기준으로
-- - SELECT: public 읽기 허용(공개 URL 표시 + upsert 존재확인용)
-- - INSERT/UPDATE/DELETE: 본인 uid 폴더에 대해서만 허용
-- BookEditPage 업로드가 upsert:true 이므로 INSERT+SELECT+UPDATE 모두 필요(덮어쓰기).
-- 추가로 이미지 MIME 화이트리스트 + 15MB 상한.
-- ============================================================

-- 0) 기존 정책 정리 — 원격의 permissive ALL 정책 + (환경별로 존재할 수 있는) 구버전 정책
DROP POLICY IF EXISTS "chapter_photos_all" ON storage.objects;
DROP POLICY IF EXISTS "chapter_photos_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "chapter_photos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "chapter_photos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "chapter_photos_delete_own" ON storage.objects;
DROP POLICY IF EXISTS "chapter_photos_select_public" ON storage.objects;

-- 1) 공개 읽기 (버킷이 public — 공개 URL 표시 및 upsert 존재 확인 지원)
CREATE POLICY "chapter_photos_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-photos');

-- 2) 업로드 — 본인 uid 폴더에만
CREATE POLICY "chapter_photos_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chapter-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3) 덮어쓰기(upsert) — 본인 파일만
CREATE POLICY "chapter_photos_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chapter-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'chapter-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4) 삭제 — 본인 파일만
CREATE POLICY "chapter_photos_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chapter-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 5) 버킷 제약: 이미지 MIME 화이트리스트 + 15MB 상한 (임의 파일 호스팅 방지)
UPDATE storage.buckets
SET file_size_limit    = 15728640,  -- 15 MB
    allowed_mime_types = ARRAY[
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/gif',  'image/heic', 'image/heif', 'image/avif'
    ]
WHERE id = 'chapter-photos';
