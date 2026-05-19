-- ============================================================
-- 20260518000002_rpc_trigger_short_book_generation.sql
-- 함수명: trigger_short_book_generation(senior_id, utterance_ids, topic_title) → uuid
-- 용도: 단편 책 생성 job을 pending 상태로 생성하고 job_id 반환
--       stage_payload에 book_type='short', utterance_ids, topic_title 저장
-- 권한: 어르신 본인 또는 service_role만 호출 가능
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_short_book_generation(
  p_senior_id     UUID,
  p_utterance_ids UUID[],
  p_topic_title   TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- 호출자 권한 검증: 본인 또는 service_role만 허용
  IF auth.uid() IS NOT NULL AND auth.uid() != p_senior_id THEN
    RAISE EXCEPTION 'permission denied: 본인 또는 service_role만 호출 가능합니다';
  END IF;

  -- 발화 목록 필수 검증
  IF p_utterance_ids IS NULL OR array_length(p_utterance_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'utterance_ids는 비어있을 수 없습니다';
  END IF;

  -- pending 상태로 단편 job 생성
  -- stage_payload에 book_type='short' + 선택된 발화 ID 목록 + 주제명 보존
  INSERT INTO public.book_generation_jobs(senior_id, status, stage_payload)
  VALUES (
    p_senior_id,
    'pending',
    jsonb_build_object(
      'book_type',     'short',
      'utterance_ids', to_jsonb(p_utterance_ids),
      'topic_title',   p_topic_title
    )
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

ALTER FUNCTION public.trigger_short_book_generation(UUID, UUID[], TEXT)
  OWNER TO postgres;

-- 일반 인증 사용자도 호출 가능 (내부에서 auth.uid() 검증)
GRANT EXECUTE ON FUNCTION public.trigger_short_book_generation(UUID, UUID[], TEXT)
  TO authenticated;
