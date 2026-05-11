-- ============================================================
-- 012_cron_fix.sql — pg_cron 월말 스케줄 수정
-- 변경 내용: 매월 1일 → 매월 말일 트리거로 변경
--
-- pg_cron L(last day) 미지원 대응:
--   '0 0 28-31 * *' 스케줄로 등록하고,
--   Edge Function 내부에서 "오늘이 해당 월의 마지막 날인지" 체크하는 방식 사용.
--   (Supabase pg_cron은 vixie-cron 기반으로 L 미지원)
-- ============================================================

-- 기존 매월 1일 스케줄 제거
SELECT cron.unschedule('monthly-book-generation');

-- 매월 28~31일 자정 실행 + Edge Function 내부에서 말일 체크
-- 실제 말일에만 처리되도록 Edge Function이 날짜를 검증함
SELECT cron.schedule(
  'monthly-book-generation',
  '0 0 28-31 * *',
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
