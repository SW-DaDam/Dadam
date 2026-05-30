-- 어르신 기본 정보(호칭/성별/생년) 단일 트랜잭션 업데이트 RPC
-- 호출 주체: 어르신 본인. SECURITY INVOKER로 RLS(own_profile, own_senior_profile)가
-- 자연스럽게 적용되어 auth.uid() != id면 UPDATE가 0건 → IF NOT FOUND로 트랜잭션 전체 중단.
--
-- 도입 배경: 기존 프론트엔드는 profiles와 senior_profiles를 순차적으로 두 번 호출 →
-- 둘째 호출 실패 시 첫째만 커밋되는 부분 커밋 상태 발생. 단일 RPC 함수 본문은
-- plpgsql 트랜잭션 컨텍스트에서 실행되므로 두 UPDATE가 원자적으로 적용·롤백됨.

CREATE OR REPLACE FUNCTION public.update_senior_basic_info(
  p_display_name text,
  p_gender       text,
  p_birth_date   date
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  -- 호출자 인증 확인 — 비인증 호출은 즉시 차단
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION '인증되지 않은 요청입니다' USING ERRCODE = '42501';
  END IF;

  -- 호칭 유효성 검증 (기존 update_chapter_title과 동일 패턴)
  IF length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION '호칭은 빈 문자열일 수 없습니다';
  END IF;
  IF length(p_display_name) > 50 THEN
    RAISE EXCEPTION '호칭은 50자를 초과할 수 없습니다';
  END IF;

  -- gender CHECK 제약(20260512003821 마이그레이션)과 일치 — null 또는 'male'/'female'만 허용
  IF p_gender IS NOT NULL AND p_gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION '성별 값이 올바르지 않습니다: %', p_gender;
  END IF;

  -- 1) profiles.display_name 업데이트
  UPDATE public.profiles
  SET display_name = trim(p_display_name),
      updated_at   = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '프로필을 찾을 수 없습니다' USING ERRCODE = 'P0002';
  END IF;

  -- 2) senior_profiles.gender / birth_date 업데이트
  -- 같은 트랜잭션 내이므로 여기서 실패 시 위 profiles UPDATE도 자동 롤백됨
  UPDATE public.senior_profiles
  SET gender     = p_gender,
      birth_date = p_birth_date,
      updated_at = now()
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '시니어 프로필을 찾을 수 없습니다' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- authenticated 롤만 호출 가능 (RLS는 SECURITY INVOKER로 자동 적용)
GRANT EXECUTE ON FUNCTION public.update_senior_basic_info(text, text, date) TO authenticated;
