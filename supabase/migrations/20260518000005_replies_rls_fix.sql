-- replies RLS 정책 수정
-- 문제 1: senior_manages_replies가 FOR ALL이라 가족은 INSERT 불가
-- 문제 2: family_reads_replies가 chapter_id 기반 JOIN → comments가 book_id 기반이라 항상 실패

DROP POLICY IF EXISTS "senior_manages_replies" ON public.replies;
DROP POLICY IF EXISTS "family_reads_replies"   ON public.replies;

-- 본인 답장 관리 (저자·가족 모두 자기 senior_id로 쓴 답장 관리)
CREATE POLICY "replies_manage_own" ON public.replies
  FOR ALL USING (senior_id = auth.uid());

-- 접근 가능한 책의 답장 읽기 (book_id 기반)
CREATE POLICY "replies_select_accessible" ON public.replies
  FOR SELECT USING (
    comment_id IN (
      SELECT cm.id FROM public.comments cm
      JOIN public.books b ON cm.book_id = b.id
      WHERE b.senior_id = auth.uid()
         OR (b.status = 'published' AND public.is_family_of(b.senior_id))
    )
  );
