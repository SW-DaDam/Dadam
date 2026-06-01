-- ============================================================
-- 20260529000001_fix_trigger_book_generation_auth.sql
-- 보안 수정(P1-2): trigger_book_generation 미인증(anon) 우회 차단
--
-- [문제]
-- 기존 권한 검증이 `IF auth.uid() IS NOT NULL AND auth.uid() != p_senior_id`
-- 였는데, auth.uid() IS NULL(미인증/anon)인 경우 조건이 거짓이 되어 그대로 통과했다.
-- 게다가 함수 EXECUTE 권한이 PUBLIC/anon 에게도 부여돼 있어, 익명 호출자가 임의
-- p_senior_id 로 book_generation_jobs 를 무제한 생성할 수 있었다(SECURITY DEFINER → RLS 우회).
--
-- [수정]
-- 1) service_role(auth.uid()=NULL이지만 auth.role()='service_role')은 허용,
--    그 외에는 auth.uid()가 본인(p_senior_id)일 때만 허용하도록 조건 강화.
-- 2) PUBLIC/anon 의 EXECUTE 권한 회수, authenticated 에게만 부여(서버 service_role은 유지).
--
-- 함수 본문(중복 방지 로직 등)은 원격 DB의 현재 정의를 그대로 보존한다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_book_generation(
  p_senior_id uuid,
  p_year      integer,
  p_month     integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER  -- service_role 권한으로 실행 (RLS 우회)
AS $function$
DECLARE
  v_job_id UUID;
BEGIN
  -- 호출자 권한 검증: service_role 또는 본인만 허용
  -- [보안] auth.role()로 service_role을 명시적으로 구분 — anon(uid NULL)은 차단된다
  IF auth.role() <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() != p_senior_id) THEN
    RAISE EXCEPTION 'permission denied: 본인 또는 service_role만 호출 가능합니다';
  END IF;

  -- 중복 job 방지: stage_payload의 target_year/target_month 기준으로 비교
  -- created_at 기준이면 테스트 중 다른 달 job이 같은 월에 생성돼 충돌 발생
  SELECT id INTO v_job_id
  FROM public.book_generation_jobs
  WHERE senior_id = p_senior_id
    AND status IN ('pending', 'aggregating', 'chaptering', 'cover_requested', 'done')
    AND (stage_payload->>'target_year')::integer  = p_year
    AND (stage_payload->>'target_month')::integer = p_month
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    RETURN v_job_id;
  END IF;

  -- pending 상태로 신규 job 생성
  INSERT INTO public.book_generation_jobs (senior_id, status, stage_payload)
  VALUES (
    p_senior_id,
    'pending',
    jsonb_build_object('target_year', p_year, 'target_month', p_month)
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$function$;

-- 함수 소유권: postgres (service_role과 동일 권한 보장)
ALTER FUNCTION public.trigger_book_generation(uuid, integer, integer) OWNER TO postgres;

-- 익명/PUBLIC 실행 권한 회수 (defense in depth — 함수 본문 진입 전에 차단)
REVOKE EXECUTE ON FUNCTION public.trigger_book_generation(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_book_generation(uuid, integer, integer) FROM anon;
-- 인증 사용자에게만 EXECUTE 부여 (내부 service_role 호출은 별도 명시적 권한으로 유지)
GRANT EXECUTE ON FUNCTION public.trigger_book_generation(uuid, integer, integer) TO authenticated;
