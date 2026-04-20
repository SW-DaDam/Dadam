-- ============================================================
-- 003_indexes.sql — 인덱스 생성 (ERD §5 기준)
-- ============================================================

CREATE INDEX idx_profiles_role ON public.profiles(role);

CREATE INDEX idx_family_links_senior_accepted
  ON public.family_links(senior_id) WHERE invite_status = 'accepted';

CREATE INDEX idx_family_links_family_accepted
  ON public.family_links(family_id) WHERE invite_status = 'accepted';

CREATE INDEX idx_family_links_invite_code_pending
  ON public.family_links(invite_code) WHERE invite_status = 'pending';

CREATE INDEX idx_conversations_senior_started
  ON public.conversations(senior_id, started_at DESC);

CREATE INDEX idx_conversations_senior_created
  ON public.conversations(senior_id, created_at);

CREATE INDEX idx_utterances_conversation_seq
  ON public.utterances(conversation_id, sequence_number);

CREATE INDEX idx_utterances_tags
  ON public.utterances USING GIN(tags);

CREATE INDEX idx_books_senior_status
  ON public.books(senior_id, status);

CREATE INDEX idx_books_senior_year_month
  ON public.books(senior_id, year, month);

CREATE INDEX idx_books_published_at
  ON public.books(published_at) WHERE published_at IS NOT NULL;

CREATE INDEX idx_chapters_book_order
  ON public.chapters(book_id, sort_order) WHERE is_deleted = false;

CREATE INDEX idx_comments_chapter_created
  ON public.comments(chapter_id, created_at);

CREATE INDEX idx_replies_comment
  ON public.replies(comment_id);

CREATE INDEX idx_notifications_recipient_unread
  ON public.notifications(recipient_id, created_at DESC) WHERE is_read = false;

CREATE INDEX idx_memories_data
  ON public.memories USING GIN(data);
