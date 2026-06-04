-- 댓글 이모지 반응 기능
CREATE TABLE IF NOT EXISTS public.comment_reactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID        NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      TEXT        NOT NULL CHECK (emoji IN ('❤️', '👍', '😢')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select"
  ON public.comment_reactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "reactions_insert_own"
  ON public.comment_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete_own"
  ON public.comment_reactions FOR DELETE
  USING (user_id = auth.uid());
