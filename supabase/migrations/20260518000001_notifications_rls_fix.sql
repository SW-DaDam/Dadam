-- notifications RLS: FOR ALL 정책을 조작별로 분리
-- 기존 정책은 INSERT에도 recipient_id = auth.uid() 제약을 걸어
-- 다른 사용자에게 알림을 INSERT할 수 없었음

DROP POLICY IF EXISTS "own_notifications" ON public.notifications;

-- 본인 알림만 조회
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- 본인 알림만 수정 (읽음 처리)
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- 본인 알림만 삭제
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE USING (recipient_id = auth.uid());

-- 인증된 사용자는 누구에게나 알림 INSERT 가능 (댓글/대댓글 알림 발송)
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
