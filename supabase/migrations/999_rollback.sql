-- ============================================================
-- 999_rollback.sql — 전체 롤백 스크립트
-- ⚠️ 주의: 실행 시 모든 데이터가 삭제됩니다
-- 실행: Supabase MCP execute_sql (apply_migration 아님)
-- ============================================================

-- pg_cron 잡 제거
SELECT cron.unschedule('monthly-book-generation');
SELECT cron.unschedule('expire-invites');
SELECT cron.unschedule('cleanup-conversations');

-- Realtime publication 제거
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.notifications;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.comments;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.replies;

-- Storage 정책 제거
DROP POLICY IF EXISTS "avatar_upload_own"             ON storage.objects;
DROP POLICY IF EXISTS "avatar_update_own"             ON storage.objects;
DROP POLICY IF EXISTS "avatar_delete_own"             ON storage.objects;
DROP POLICY IF EXISTS "avatar_read_public"            ON storage.objects;
DROP POLICY IF EXISTS "book_cover_read_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "book_cover_upload"             ON storage.objects;
DROP POLICY IF EXISTS "book_cover_update"             ON storage.objects;
DROP POLICY IF EXISTS "reply_audio_upload"            ON storage.objects;

-- Storage 버킷 제거
DELETE FROM storage.buckets WHERE id IN ('avatars', 'book-covers', 'reply-audio');

-- 트리거 제거
DROP TRIGGER IF EXISTS on_auth_user_created      ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at            ON public.profiles;
DROP TRIGGER IF EXISTS set_updated_at            ON public.senior_profiles;
DROP TRIGGER IF EXISTS set_updated_at            ON public.memories;
DROP TRIGGER IF EXISTS set_updated_at            ON public.books;
DROP TRIGGER IF EXISTS set_updated_at            ON public.chapters;
DROP TRIGGER IF EXISTS set_updated_at            ON public.comments;
DROP TRIGGER IF EXISTS set_updated_at            ON public.book_generation_jobs;

-- 함수 제거
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at();
DROP FUNCTION IF EXISTS public.get_user_role();
DROP FUNCTION IF EXISTS public.is_family_of(UUID);

-- 테이블 DROP (FK 역순)
DROP TABLE IF EXISTS public.book_generation_jobs CASCADE;
DROP TABLE IF EXISTS public.notifications        CASCADE;
DROP TABLE IF EXISTS public.cover_images         CASCADE;
DROP TABLE IF EXISTS public.replies              CASCADE;
DROP TABLE IF EXISTS public.comments             CASCADE;
DROP TABLE IF EXISTS public.chapters             CASCADE;
DROP TABLE IF EXISTS public.books                CASCADE;
DROP TABLE IF EXISTS public.utterances           CASCADE;
DROP TABLE IF EXISTS public.conversations        CASCADE;
DROP TABLE IF EXISTS public.memories             CASCADE;
DROP TABLE IF EXISTS public.family_links         CASCADE;
DROP TABLE IF EXISTS public.senior_profiles      CASCADE;
DROP TABLE IF EXISTS public.profiles             CASCADE;

-- Enum DROP
DROP TYPE IF EXISTS speaker_role;
DROP TYPE IF EXISTS cover_status;
DROP TYPE IF EXISTS notification_type;
DROP TYPE IF EXISTS utterance_tag;
DROP TYPE IF EXISTS book_type;
DROP TYPE IF EXISTS book_status;
DROP TYPE IF EXISTS invite_status;
DROP TYPE IF EXISTS user_role;
