-- senior_profiles에 AI 말투 선택 컬럼 추가
-- counselor: 공손한 상담사(존댓말, 기존 동작 유지), friend: 친근한 친구(반말)
-- 기존 사용자 포함 전체 row 디폴트 'counselor'로 초기화 → 동작 변화 없음

ALTER TABLE public.senior_profiles
  ADD COLUMN speech_style TEXT NOT NULL DEFAULT 'counselor'
    CHECK (speech_style IN ('counselor', 'friend'));

-- 롤백 절차 (필요 시):
-- ALTER TABLE public.senior_profiles DROP COLUMN IF EXISTS speech_style;
