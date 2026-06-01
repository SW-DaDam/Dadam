-- ============================================================
-- 20260529000003_restrict_net_http_post_cover.sql
-- 보안 수정(P2-4): net_http_post_cover SECURITY DEFINER 호출 범위 제한 (SSRF 차단)
--
-- [문제]
-- net_http_post_cover 는 SECURITY DEFINER 로 net.http_post(임의 URL POST)를 래핑한다.
-- 그러나 EXECUTE 권한이 PUBLIC/anon/authenticated 에까지 부여돼 있어, 일반/익명 사용자가
-- 임의의 p_url 로 DB 서버가 HTTP 요청을 보내도록 만들 수 있었다(SSRF: 내부망 스캔 등).
-- 반복 개발로 함수가 3개 시그니처로 오버로드돼 있으며 셋 다 동일하게 노출돼 있다.
--
-- [수정]
-- 이 함수는 generate-book Edge Function이 service_role 클라이언트로만 호출한다.
-- 모든 오버로드에서 PUBLIC/anon/authenticated 의 EXECUTE 를 회수하고 service_role 에만 부여.
-- ============================================================

-- 오버로드 1: (text, uuid, uuid, uuid, text)  — SECURITY DEFINER (구버전 5-arg)
REVOKE EXECUTE ON FUNCTION public.net_http_post_cover(text, uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_http_post_cover(text, uuid, uuid, uuid, text)
  TO service_role;

-- 오버로드 2: (text, text, text, text, text, text)  — 전부 text (구버전)
REVOKE EXECUTE ON FUNCTION public.net_http_post_cover(text, text, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_http_post_cover(text, text, text, text, text, text)
  TO service_role;

-- 오버로드 3: (text, uuid, uuid, uuid, text, text)  — SECURITY DEFINER (현행, Edge Function이 호출)
REVOKE EXECUTE ON FUNCTION public.net_http_post_cover(text, uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.net_http_post_cover(text, uuid, uuid, uuid, text, text)
  TO service_role;
