-- F-03 TTS 교체: OpenAI voice 6종 → Clova Voice (Phase 1: ngoeun 1종)
-- 마이그레이션 정책: 자동 톤 매핑 X. 모든 row를 ngoeun으로 통일.
-- Phase 2에서 6종 확장 시 가족이 설정창에서 직접 재선택할 예정이므로 안전.

-- 1) 기존 CHECK 제약 제거 (OpenAI 6종 화이트리스트)
ALTER TABLE public.senior_profiles
  DROP CONSTRAINT IF EXISTS senior_profiles_tts_voice_check;

-- 2) 모든 row의 tts_voice를 ngoeun으로 통일
--    Why: Phase 1은 1종만 운영. 기존 OpenAI voice ID('shimmer','nova',...) 값은
--         새 CHECK 제약(ngoeun만 허용)을 통과 못 하므로 사전에 통일 필요.
UPDATE public.senior_profiles SET tts_voice = 'ngoeun';

-- 3) 새 기본값 + CHECK 제약 (Phase 1: 1종)
--    Phase 2 확장 시 IN 리스트에 6종 추가하는 별도 마이그레이션 작성 예정.
ALTER TABLE public.senior_profiles
  ALTER COLUMN tts_voice SET DEFAULT 'ngoeun',
  ADD CONSTRAINT senior_profiles_tts_voice_check
    CHECK (tts_voice IN ('ngoeun'));

-- 롤백 절차 (필요 시):
--   주의: 본 마이그레이션은 기존 voice ID를 모두 ngoeun으로 통일했으므로
--         원 값('shimmer','nova',...) 복구는 불가능. 가족이 설정창에서 재선택 필요.
--
-- ALTER TABLE public.senior_profiles DROP CONSTRAINT senior_profiles_tts_voice_check;
-- ALTER TABLE public.senior_profiles ALTER COLUMN tts_voice SET DEFAULT 'shimmer';
-- UPDATE public.senior_profiles SET tts_voice = 'shimmer';
-- ALTER TABLE public.senior_profiles ADD CONSTRAINT senior_profiles_tts_voice_check
--   CHECK (tts_voice IN ('shimmer','nova','coral','onyx','echo','sage'));
