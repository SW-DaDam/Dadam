-- 같은 senior에 연결된 family끼리 서로의 관계 정보 조회 허용
-- 독자가 다른 독자의 관계(아들, 딸 등)를 댓글에서 볼 수 있도록
CREATE POLICY "family_reads_peer_links" ON public.family_links
  FOR SELECT USING (
    senior_id IN (
      SELECT senior_id FROM family_links
      WHERE family_id = auth.uid() AND invite_status = 'accepted'
    )
  );
