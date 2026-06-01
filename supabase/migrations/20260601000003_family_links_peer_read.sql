-- 재귀 없는 family peer 조회 (SECURITY DEFINER로 RLS 루프 방지)
-- 같은 senior에 연결된 독자끼리 서로의 관계 정보 조회 허용

CREATE OR REPLACE FUNCTION public.get_senior_ids_for_family(family_uuid UUID)
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT senior_id FROM family_links
  WHERE family_id = family_uuid AND invite_status = 'accepted';
$$;

DROP POLICY IF EXISTS "family_reads_peer_links" ON public.family_links;

CREATE POLICY "family_reads_peer_links" ON public.family_links
  FOR SELECT USING (
    senior_id = ANY(ARRAY(SELECT public.get_senior_ids_for_family(auth.uid())))
  );
