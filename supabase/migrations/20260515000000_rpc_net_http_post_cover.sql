-- ============================================================
-- 20260515000000_rpc_net_http_post_cover.sql
-- 함수명: net_http_post_cover(p_url, p_book_id, p_senior_id, p_chapter_id, p_secret, p_anon_key)
-- 용도: generate-book Edge Function이 챕터 1개씩 generate-cover를 비동기 호출할 때 사용
--       pg_net을 래핑하여 내부 인증(INTERNAL_COVER_SECRET)과 함께 POST 요청 전송
-- 권한: service_role 전용 (Edge Function 내부에서만 호출)
-- 참고: pg_net은 Supabase에 기본 설치됨 (net.http_post)
-- ============================================================

CREATE OR REPLACE FUNCTION public.net_http_post_cover(
  p_url       TEXT,
  p_book_id   UUID,
  p_senior_id UUID,
  p_chapter_id UUID,
  p_secret    TEXT,
  p_anon_key  TEXT
)
RETURNS BIGINT  -- pg_net request_id 반환
LANGUAGE plpgsql
SECURITY DEFINER  -- service_role 권한으로 실행
AS $$
DECLARE
  v_request_id BIGINT;
BEGIN
  SELECT net.http_post(
    url     := p_url,
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'Authorization',     'Bearer ' || p_anon_key,
      'X-Internal-Secret', p_secret
    ),
    body    := jsonb_build_object(
      'book_id',    p_book_id,
      'senior_id',  p_senior_id,
      'chapter_id', p_chapter_id,
      'mode',       'batch_single'
    )
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- service_role만 호출 가능 (authenticated/anon에는 부여하지 않음)
ALTER FUNCTION public.net_http_post_cover(TEXT, UUID, UUID, UUID, TEXT, TEXT)
  OWNER TO postgres;
