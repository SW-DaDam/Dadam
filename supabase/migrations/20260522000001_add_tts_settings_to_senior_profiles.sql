-- senior_profiles에 TTS 설정 컬럼 2개 추가
-- voice: gpt-4o-mini-tts의 voice ID (shimmer 디폴트 — TASK-T3 청취 평가 후 확정)
-- speed: TTS instruction 매핑 (slow 디폴트 — 시니어 청력·인지 속도 고려)
-- 음량은 디바이스 시스템 볼륨에 위임 (DB 저장 안 함)

ALTER TABLE public.senior_profiles
  ADD COLUMN tts_voice TEXT NOT NULL DEFAULT 'shimmer'
    CHECK (tts_voice IN ('shimmer','nova','coral','onyx','echo','sage')),
  ADD COLUMN tts_speed TEXT NOT NULL DEFAULT 'slow'
    CHECK (tts_speed IN ('slow','normal','fast'));

-- 롤백 절차 (필요 시):
-- ALTER TABLE public.senior_profiles
--   DROP COLUMN IF EXISTS tts_voice,
--   DROP COLUMN IF EXISTS tts_speed;
