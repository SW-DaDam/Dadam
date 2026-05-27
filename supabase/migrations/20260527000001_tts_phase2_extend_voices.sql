-- TTS Phase 2: 화자 6종 확장 + 디폴트 봄달(noyj) 변경
-- Phase 1: ngoeun 1종 → Phase 2: nyejin/noyj/vara/nminsang/nsiyoon/vian 6종
-- 기존 사용자: tts_voice ngoeun→noyj, tts_speed 전부→normal 일괄 변경

-- 1) 기존 CHECK 제약 제거 (Phase 1: ngoeun 1종)
ALTER TABLE public.senior_profiles
  DROP CONSTRAINT IF EXISTS senior_profiles_tts_voice_check;

-- 2) ngoeun 사용자 → noyj(봄달) 마이그레이션
UPDATE public.senior_profiles
  SET tts_voice = 'noyj'
  WHERE tts_voice = 'ngoeun';

-- 3) 기존 사용자 speed 전부 normal로 초기화
--    Phase 1 디폴트가 slow였으므로 Phase 2 봄달 기준(속도 0=normal)에 맞게 일괄 조정
UPDATE public.senior_profiles
  SET tts_speed = 'normal';

-- 4) 컬럼 기본값 변경
ALTER TABLE public.senior_profiles
  ALTER COLUMN tts_voice SET DEFAULT 'noyj',
  ALTER COLUMN tts_speed SET DEFAULT 'normal';

-- 5) 새 CHECK 제약 추가 (6종)
ALTER TABLE public.senior_profiles
  ADD CONSTRAINT senior_profiles_tts_voice_check
    CHECK (tts_voice IN ('nyejin', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'));

-- 롤백 절차 (필요 시):
-- ALTER TABLE public.senior_profiles DROP CONSTRAINT senior_profiles_tts_voice_check;
-- ALTER TABLE public.senior_profiles ALTER COLUMN tts_voice SET DEFAULT 'ngoeun';
-- ALTER TABLE public.senior_profiles ALTER COLUMN tts_speed SET DEFAULT 'slow';
-- ALTER TABLE public.senior_profiles ADD CONSTRAINT senior_profiles_tts_voice_check
--   CHECK (tts_voice IN ('ngoeun'));
-- NOTE: 원본 voice/speed 값은 복구 불가 (마이그레이션 전 백업 필요)
