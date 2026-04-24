-- ============================================================
-- 008_cron.sql — pg_cron 스케줄 등록
-- 사전 요구사항: pg_cron 익스텐션 활성화 (대시보드 Database > Extensions)
-- ============================================================

-- pg_cron 익스텐션 활성화 (로컬 개발 환경용, 프로덕션은 대시보드에서 활성화)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- 매월 1일 자정: 월말 책 초안 생성 Edge Function 호출
SELECT cron.schedule(
  'monthly-book-generation',
  '0 0 1 * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/generate-book',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    )
  $$
);

-- 매시 정각: 만료된 초대 상태 처리
SELECT cron.schedule(
  'expire-invites',
  '0 * * * *',
  $$
    UPDATE public.family_links
    SET invite_status = 'expired'
    WHERE invite_status = 'pending'
      AND expires_at < now()
  $$
);

-- 매주 일요일 새벽 3시: 출간 후 1년 지난 대화 삭제
SELECT cron.schedule(
  'cleanup-conversations',
  '0 3 * * 0',
  $$
    DELETE FROM public.conversations c
    WHERE EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.status = 'published'
        AND b.published_at < now() - INTERVAL '1 year'
        AND b.senior_id = c.senior_id
        AND b.year = EXTRACT(YEAR FROM c.started_at)
        AND b.month = EXTRACT(MONTH FROM c.started_at)
    )
  $$
);
