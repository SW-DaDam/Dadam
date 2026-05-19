-- comments 테이블에 음성 댓글 URL 컬럼 추가
-- replies.audio_url 과 동일한 패턴으로 reply-audio 버킷 경로 저장

ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS audio_url TEXT NULL;
