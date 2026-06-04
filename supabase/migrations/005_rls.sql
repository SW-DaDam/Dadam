-- ============================================================
-- 005_rls.sql — RLS 헬퍼 함수 및 정책
-- ============================================================

-- 헬퍼: 현재 인증 사용자의 역할 반환
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 헬퍼: 현재 사용자가 특정 어르신의 수락된 가족인지 확인
CREATE OR REPLACE FUNCTION public.is_family_of(p_senior_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_links
    WHERE senior_id = p_senior_id
      AND family_id = auth.uid()
      AND invite_status = 'accepted'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS 활성화
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.senior_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_links         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utterances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cover_images         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_generation_jobs ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "own_profile"          ON public.profiles FOR ALL    USING (id = auth.uid());
CREATE POLICY "family_reads_senior"  ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.family_links WHERE senior_id = profiles.id AND family_id = auth.uid() AND invite_status = 'accepted')
);

-- senior_profiles
CREATE POLICY "own_senior_profile"         ON public.senior_profiles FOR ALL    USING (id = auth.uid());
CREATE POLICY "family_reads_senior_profile" ON public.senior_profiles FOR SELECT USING (public.is_family_of(id));

-- family_links
CREATE POLICY "own_family_links" ON public.family_links FOR ALL USING (senior_id = auth.uid() OR family_id = auth.uid());

-- memories
CREATE POLICY "senior_own_memory" ON public.memories FOR ALL USING (senior_id = auth.uid());

-- conversations
CREATE POLICY "senior_own_conversations" ON public.conversations FOR ALL USING (senior_id = auth.uid());

-- utterances
CREATE POLICY "senior_own_utterances" ON public.utterances FOR ALL USING (
  conversation_id IN (SELECT id FROM public.conversations WHERE senior_id = auth.uid())
);

-- books
CREATE POLICY "senior_own_books"           ON public.books FOR ALL    USING (senior_id = auth.uid());
CREATE POLICY "family_reads_published_books" ON public.books FOR SELECT USING (status = 'published' AND public.is_family_of(senior_id));

-- chapters
CREATE POLICY "senior_own_chapters" ON public.chapters FOR ALL USING (
  book_id IN (SELECT id FROM public.books WHERE senior_id = auth.uid())
);
CREATE POLICY "family_reads_published_chapters" ON public.chapters FOR SELECT USING (
  is_deleted = false AND book_id IN (SELECT id FROM public.books WHERE status = 'published' AND public.is_family_of(senior_id))
);

-- comments
CREATE POLICY "own_comments"          ON public.comments FOR ALL    USING (author_id = auth.uid());
CREATE POLICY "family_reads_comments" ON public.comments FOR SELECT USING (
  chapter_id IN (SELECT c.id FROM public.chapters c JOIN public.books b ON c.book_id = b.id WHERE b.status = 'published' AND public.is_family_of(b.senior_id))
);
CREATE POLICY "senior_reads_comments" ON public.comments FOR SELECT USING (
  chapter_id IN (SELECT c.id FROM public.chapters c JOIN public.books b ON c.book_id = b.id WHERE b.senior_id = auth.uid())
);

-- replies
CREATE POLICY "senior_manages_replies" ON public.replies FOR ALL    USING (senior_id = auth.uid());
CREATE POLICY "family_reads_replies"   ON public.replies FOR SELECT USING (
  comment_id IN (SELECT cm.id FROM public.comments cm JOIN public.chapters ch ON cm.chapter_id = ch.id JOIN public.books b ON ch.book_id = b.id WHERE b.status = 'published' AND public.is_family_of(b.senior_id))
);

-- cover_images
CREATE POLICY "senior_own_cover_images" ON public.cover_images FOR ALL USING (
  book_id IN (SELECT id FROM public.books WHERE senior_id = auth.uid())
);

-- notifications
CREATE POLICY "own_notifications" ON public.notifications FOR ALL USING (recipient_id = auth.uid());

-- book_generation_jobs
CREATE POLICY "senior_own_generation_jobs" ON public.book_generation_jobs FOR ALL USING (
  book_id IN (SELECT id FROM public.books WHERE senior_id = auth.uid())
);
