-- notifications RLS 수정: INSERT는 누구에게든 가능하도록
-- 기존 FOR ALL 정책은 INSERT도 막아서 대댓글 알림이 전달되지 않음

DROP POLICY IF EXISTS "own_notifications" ON public.notifications;

CREATE POLICY "select_own_notifications" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "update_own_notifications" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid());

CREATE POLICY "delete_own_notifications" ON public.notifications
  FOR DELETE USING (recipient_id = auth.uid());

-- 로그인 유저라면 다른 유저에게 알림 INSERT 가능
CREATE POLICY "insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
