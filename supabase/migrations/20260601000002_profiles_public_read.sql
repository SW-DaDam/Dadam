-- 로그인한 사용자는 모든 프로필 조회 가능 (이름·프사는 공개 정보)
-- 독자가 다른 독자의 이름을 댓글에서 볼 수 있도록
CREATE POLICY "authenticated_reads_profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);
