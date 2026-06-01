-- ============================================================
-- 20260529000002_fix_trigger_short_book_generation_auth.sql
-- 보안 수정(P1-3): trigger_short_book_generation 미인증(anon) 우회 차단
--
-- trigger_book_generation(P1-2)과 동일한 취약점:
-- `auth.uid() IS NOT NULL AND auth.uid() != p_senior_id` 조건이 미인증(anon, uid NULL)을
-- 통과시키고, EXECUTE 권한이 PUBLIC/anon 에 부여돼 있어 익명 호출자가 임의 senior 로
-- 단편 책 job 을 생성할 수 있었다(SECURITY DEFINER → RLS 우회).
--
-- [수정] 권한 검증을 service_role/본인만 허용하도록 강화 + PUBLIC/anon EXECUTE 회수.
-- 함수 본문(utterance_ids 검증, job insert)은 원격 DB 현재 정의를 보존하되,
-- 동일 함수를 두 번 재정의하지 않도록 P3-14(중복 pending job 방지)도 여기서 함께 반영한다.
-- ============================================================

CREATE OR REPLACE FUNCTION public.trigger_short_book_generation(
  p_senior_id     uuid,
  p_utterance_ids uuid[],
  p_topic_title   text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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

  IF p_utterance_ids IS NULL OR array_length(p_utterance_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'utterance_ids는 비어있을 수 없습니다';
  END IF;

  -- [P3-14] 중복 방지: 같은 topic 으로 진행 중인 job 이 있으면 신규 생성 대신 그 job_id 반환
  -- (이중 클릭·네트워크 재시도로 인한 중복 pending job 생성 차단.
  --  'done'/'failed'는 제외 → 완료/실패 후 같은 주제로 재생성하는 것은 허용)
  SELECT id INTO v_job_id
  FROM public.book_generation_jobs
  WHERE senior_id = p_senior_id
    AND status IN ('pending', 'aggregating', 'chaptering', 'cover_requested')
    AND stage_payload->>'book_type'   = 'short'
    AND stage_payload->>'topic_title' = p_topic_title
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    RETURN v_job_id;
  END IF;

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
$function$;

-- 함수 소유권: postgres (service_role과 동일 권한 보장)
ALTER FUNCTION public.trigger_short_book_generation(uuid, uuid[], text) OWNER TO postgres;

-- 익명/PUBLIC 실행 권한 회수 (defense in depth)
REVOKE EXECUTE ON FUNCTION public.trigger_short_book_generation(uuid, uuid[], text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_short_book_generation(uuid, uuid[], text) FROM anon;
-- 인증 사용자에게만 EXECUTE 부여
GRANT EXECUTE ON FUNCTION public.trigger_short_book_generation(uuid, uuid[], text) TO authenticated;
