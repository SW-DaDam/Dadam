-- 알림 수신 설정을 profiles에 JSONB로 저장
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;
