-- ============================================================
-- 011_rpc_trigger_book_generation.sql — 수동 테스트용 RPC
-- 함수명: trigger_book_generation(senior_id, year, month) → uuid
-- 용도: pg_cron 없이 특정 어르신·연월로 파이프라인 수동 트리거
-- 반환: 생성된 job_id
-- 권한: 어르신 본인 또는 service_role만 호출 가능
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_book_generation(
  p_senior_id UUID,
  p_year      INTEGER,
  p_month     INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER  -- service_role 권한으로 실행 (RLS 우회)
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- 호출자 권한 검증: 본인 또는 service_role만 허용
  IF auth.uid() IS NOT NULL AND auth.uid() != p_senior_id THEN
    RAISE EXCEPTION 'permission denied: 본인 또는 service_role만 호출 가능합니다';
  END IF;

  -- 이미 processing 계열 job이 있으면 예외 (중복 방지)
  -- TIMESTAMPTZ 범위로 해당 연/월 비교 (make_date는 DATE 반환 — 타임존 불명확)
  IF EXISTS (
    SELECT 1 FROM public.book_generation_jobs
    WHERE senior_id = p_senior_id
      AND status IN (
        'aggregating'::job_status,
        'chaptering'::job_status,
        'cover_requested'::job_status,
        'done'::job_status
      )
      AND created_at >= make_timestamptz(p_year, p_month, 1, 0, 0, 0)
      AND created_at < make_timestamptz(
            CASE WHEN p_month = 12 THEN p_year + 1 ELSE p_year END,
            CASE WHEN p_month = 12 THEN 1 ELSE p_month + 1 END,
            1, 0, 0, 0
          )
  ) THEN
    RAISE EXCEPTION '이미 처리 중이거나 완료된 job이 있습니다 (senior_id: %, year: %, month: %)',
      p_senior_id, p_year, p_month;
  END IF;

  -- pending 상태로 job 생성 후 job_id 반환
  -- target_year/target_month를 stage_payload에 보존해야
  -- Edge Function이 new Date() 대신 요청된 연/월로 파이프라인을 실행할 수 있음
  INSERT INTO public.book_generation_jobs (senior_id, status, stage_payload)
  VALUES (
    p_senior_id,
    'pending',
    jsonb_build_object('target_year', p_year, 'target_month', p_month)
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

-- 함수 소유권: postgres (service_role과 동일 권한 보장)
ALTER FUNCTION public.trigger_book_generation(UUID, INTEGER, INTEGER)
  OWNER TO postgres;

-- 일반 인증 사용자도 RPC 호출 가능하게 EXECUTE 권한 부여
-- (내부에서 auth.uid() 검증으로 본인만 실행 가능)
GRANT EXECUTE ON FUNCTION public.trigger_book_generation(UUID, INTEGER, INTEGER)
  TO authenticated;
