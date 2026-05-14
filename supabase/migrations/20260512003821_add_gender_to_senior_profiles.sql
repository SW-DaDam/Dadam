-- senior_profiles에 성별 컬럼 추가
-- 표지 생성(generate-cover) 및 챗봇(voice-chat)에서 성별/나이대 정보로 추후 활용
ALTER TABLE senior_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female')) DEFAULT NULL;
