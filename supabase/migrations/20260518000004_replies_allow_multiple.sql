-- replies.comment_id UNIQUE 제약 제거
-- 기존: 댓글 1개당 답장 1개 (저자 전용)
-- 변경: 여러 사람이 같은 댓글에 답장 가능

ALTER TABLE public.replies DROP CONSTRAINT IF EXISTS replies_comment_id_key;
