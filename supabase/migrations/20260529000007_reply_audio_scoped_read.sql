-- ============================================================
-- 20260529000007_reply_audio_scoped_read.sql
-- 보안 수정(P2-7): reply-audio 읽기를 책의 가족 서클 참여자로 제한
--
-- [문제]
-- SELECT 정책이 `bucket_id='reply-audio'`뿐(모든 authenticated 전체 읽기) → 아무 인증
-- 사용자가 타인 음성에 대한 서명 URL(createSignedUrl)을 생성 가능. 게다가 동일 정책이
-- 2개 중복(reply_audio_read, reply_audio_select_authenticated) 존재.
--
-- [제약]
-- 듣는 사람 ≠ 올린 사람(가족이 senior의 답장 음성을 들어야 함)이라 경로 소유권만으론 불가.
-- 올바른 범위 = "해당 음성이 속한 책의 가족 서클 참여자(senior 본인 + accepted 가족)".
--
-- [해결]
-- 서명 URL은 Postgres에서 직접 생성할 수 없으므로(스토리지 서비스가 서명), 클라이언트의
-- createSignedUrl 흐름은 유지하되 SELECT 정책을 객체별 접근권으로 좁힌다.
-- can_access_reply_audio(name) SECURITY DEFINER 헬퍼가 경로에서 reply/comment 를 역추적해
-- 책의 senior 를 찾고, shares_family_circle 로 서클 소속을 판정한다(fail-closed).
--
-- 의존: shares_family_circle (20260529000006). 본 마이그레이션이 이후에 적용됨.
-- 경로 형식:
--   - 댓글 음성: 'comments/{commenterId}/{commentId}.webm'  (SeniorBookReadPage.tsx:439)
--   - 답장 음성: '{replierId}/{replyId}.webm'                (useVoiceReply.ts:95)
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_reply_audio(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_senior_id uuid;
  v_id_text   text;
  v_id        uuid;
BEGIN
  -- 비인증 호출은 즉시 거부
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  -- 경로 마지막 세그먼트에서 파일명 추출 후 확장자 제거 → 대상 UUID
  v_id_text := split_part(p_name, '/', array_length(string_to_array(p_name, '/'), 1));
  v_id_text := regexp_replace(v_id_text, '\.[^.]+$', '');  -- 예: '.webm' 제거

  -- UUID 변환 실패(형식 이상) → fail-closed
  BEGIN
    v_id := v_id_text::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;

  IF p_name LIKE 'comments/%' THEN
    -- 댓글 음성: comments.id = v_id → book.senior_id
    SELECT b.senior_id INTO v_senior_id
    FROM public.comments cm
    JOIN public.books b ON cm.book_id = b.id
    WHERE cm.id = v_id;
  ELSE
    -- 답장 음성: replies.id = v_id → comment → book.senior_id
    SELECT b.senior_id INTO v_senior_id
    FROM public.replies r
    JOIN public.comments cm ON r.comment_id = cm.id
    JOIN public.books b ON cm.book_id = b.id
    WHERE r.id = v_id;
  END IF;

  -- 대상을 못 찾으면 거부
  IF v_senior_id IS NULL THEN
    RETURN false;
  END IF;

  -- 책 저자 본인 또는 같은 가족 서클 소속만 허용
  RETURN v_senior_id = auth.uid()
      OR public.shares_family_circle(auth.uid(), v_senior_id);
END;
$$;

ALTER FUNCTION public.can_access_reply_audio(text) OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.can_access_reply_audio(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_access_reply_audio(text) TO authenticated;

-- 기존의 전체 읽기 허용(중복 2개) 제거 후 범위 제한 정책으로 교체
DROP POLICY IF EXISTS "reply_audio_read" ON storage.objects;
DROP POLICY IF EXISTS "reply_audio_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "reply_audio_select_accessible" ON storage.objects;

CREATE POLICY "reply_audio_select_accessible"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reply-audio'
    AND public.can_access_reply_audio(name)
  );
