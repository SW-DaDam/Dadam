-- ============================================================
-- 007_realtime.sql — Realtime publication 설정
-- 채널 패턴: notifications:user:{user_id}
--            comments:chapter:{chapter_id}
--            replies:comment:{comment_id}
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.replies;
