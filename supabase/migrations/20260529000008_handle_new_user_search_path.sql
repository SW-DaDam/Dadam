-- ============================================================
-- 20260529000008_handle_new_user_search_path.sql
-- 보안 보강(P4-19): handle_new_user SECURITY DEFINER 함수 search_path 고정
--
-- [배경]
-- SECURITY DEFINER 함수는 search_path를 고정하지 않으면 호출자의 search_path를 상속해,
-- 동일 이름 객체(테이블/타입/함수)를 공격자 스키마에 만들어 가로채는 위험이 있다(004_triggers.sql 원본).
-- 라이브 DB의 handle_new_user에는 이미 `SET search_path = public`이 적용돼 있으나(out-of-band),
-- 어떤 마이그레이션 파일에도 반영돼 있지 않아 신규 환경 재빌드 시 누락된다.
--
-- [수정]
-- 마이그레이션 히스토리를 라이브(보안) 상태와 일치시키기 위해 search_path를 명시 고정한다.
-- 본문은 변경하지 않고 ALTER FUNCTION ... SET 으로 구성만 추가(라이브엔 이미 적용 → 멱등).
-- (pg_catalog는 search_path에 미명시해도 항상 우선 탐색되므로 'public' 고정으로 충분)
-- ============================================================

ALTER FUNCTION public.handle_new_user() SET search_path = public;
