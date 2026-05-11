-- 초대 수락 플로우를 위한 RLS 추가
-- 누구나 유효한 pending 초대를 코드로 조회할 수 있어야 함 (초대 링크 접속 시)
CREATE POLICY "read_pending_invite"
  ON public.family_links
  FOR SELECT
  USING (invite_status = 'pending' AND expires_at > now());

-- 로그인한 사용자가 pending 초대를 수락(UPDATE)할 수 있어야 함
-- family_id를 자기 uid로만 설정 가능
CREATE POLICY "accept_pending_invite"
  ON public.family_links
  FOR UPDATE
  USING (invite_status = 'pending' AND expires_at > now())
  WITH CHECK (family_id = auth.uid());
