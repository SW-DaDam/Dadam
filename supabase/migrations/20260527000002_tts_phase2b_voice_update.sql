-- TTS Phase 2b: 예진(nyejin) → 유나(nyuna) 교체, 디폴트 아라(vara) 변경
-- nyejin 사용자 → nyuna 전환, 디폴트 noyj → vara

-- 1) 기존 CHECK 제약 제거
ALTER TABLE public.senior_profiles
  DROP CONSTRAINT IF EXISTS senior_profiles_tts_voice_check;

-- 2) nyejin 사용자 → nyuna(유나) 마이그레이션
UPDATE public.senior_profiles
  SET tts_voice = 'nyuna'
  WHERE tts_voice = 'nyejin';

-- 3) 컬럼 기본값 변경: noyj → vara(아라)
ALTER TABLE public.senior_profiles
  ALTER COLUMN tts_voice SET DEFAULT 'vara';

-- 4) 새 CHECK 제약: nyejin 제거, nyuna 추가
ALTER TABLE public.senior_profiles
  ADD CONSTRAINT senior_profiles_tts_voice_check
    CHECK (tts_voice IN ('nyuna', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'));
