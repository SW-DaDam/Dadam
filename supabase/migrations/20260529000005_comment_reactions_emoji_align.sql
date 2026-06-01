-- ============================================================
-- 20260529000005_comment_reactions_emoji_align.sql
-- 버그 수정(P2-8): comment_reactions 이모지 CHECK 를 UI/reply_reactions 와 정합
--
-- [문제]
-- UI는 댓글·답글 공통으로 REACTION_EMOJIS = ['❤️','👍','😂','😢','🙏'] (5종)을 노출한다.
-- 그러나 comment_reactions.emoji CHECK 는 ('❤️','👍','😢') 3종만 허용해서,
-- 댓글에 '😂' 또는 '🙏'를 누르면 CHECK 위반으로 insert 가 실패하고 낙관적 UI와 DB가 어긋난다.
-- (reply_reactions 는 이미 5종을 허용 → 답글 반응은 정상)
--
-- [수정]
-- comment_reactions 의 허용 이모지를 reply_reactions 와 동일한 5종으로 확장.
-- 허용값 확장은 기존 행에 영향 없는 additive 변경.
-- ============================================================

ALTER TABLE public.comment_reactions
  DROP CONSTRAINT IF EXISTS comment_reactions_emoji_check;

ALTER TABLE public.comment_reactions
  ADD CONSTRAINT comment_reactions_emoji_check
  CHECK (emoji IN ('❤️', '👍', '😂', '😢', '🙏'));
