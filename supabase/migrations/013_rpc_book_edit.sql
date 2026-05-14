-- F-12/F-13 책 편집 관련 RPC 함수 5개
-- 호출 주체: 어르신 본인 (anon + RLS 검증)

-- ─── 2.1 soft_delete_chapter ─────────────────────────────────────────────────
-- 챕터를 숨김 처리 (is_deleted = true). 되돌리기 가능.
-- RLS: senior_own_chapters 정책이 book 소유자만 허용
CREATE OR REPLACE FUNCTION public.soft_delete_chapter(chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE chapters
  SET is_deleted = true,
      updated_at = now()
  WHERE id = chapter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '챕터를 찾을 수 없습니다: %', chapter_id;
  END IF;
END;
$$;

-- ─── 2.2 restore_chapter ─────────────────────────────────────────────────────
-- soft-delete된 챕터를 복구 (is_deleted = false)
CREATE OR REPLACE FUNCTION public.restore_chapter(chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  UPDATE chapters
  SET is_deleted = false,
      updated_at = now()
  WHERE id = chapter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '챕터를 찾을 수 없습니다: %', chapter_id;
  END IF;
END;
$$;

-- ─── 2.3 update_chapter_title ────────────────────────────────────────────────
-- 챕터 제목 수정. 빈 문자열·100자 초과 시 예외.
CREATE OR REPLACE FUNCTION public.update_chapter_title(chapter_id uuid, new_title text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  IF length(trim(new_title)) = 0 THEN
    RAISE EXCEPTION '제목은 빈 문자열일 수 없습니다';
  END IF;
  IF length(new_title) > 100 THEN
    RAISE EXCEPTION '제목은 100자를 초과할 수 없습니다';
  END IF;

  UPDATE chapters
  SET title = trim(new_title),
      updated_at = now()
  WHERE id = chapter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '챕터를 찾을 수 없습니다: %', chapter_id;
  END IF;
END;
$$;

-- ─── 2.4 select_cover ────────────────────────────────────────────────────────
-- 선택한 표지 URL을 books.cover_image_url에 저장
CREATE OR REPLACE FUNCTION public.select_cover(book_id uuid, cover_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_image_url text;
BEGIN
  SELECT image_url INTO v_image_url
  FROM cover_images
  WHERE id = cover_id AND cover_images.book_id = select_cover.book_id;

  IF v_image_url IS NULL THEN
    RAISE EXCEPTION '표지를 찾을 수 없습니다: %', cover_id;
  END IF;

  UPDATE books
  SET cover_image_url = v_image_url,
      updated_at = now()
  WHERE id = book_id;
END;
$$;

-- ─── 2.5 publish_book ────────────────────────────────────────────────────────
-- 단일 트랜잭션: books 출간 처리 + 수락된 가족 전원에게 알림
CREATE OR REPLACE FUNCTION public.publish_book(book_id uuid, dedication text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_senior_id uuid;
  v_title text;
  v_family record;
BEGIN
  -- 책 소유자 확인 및 출간 처리
  UPDATE books
  SET status = 'published',
      dedication = publish_book.dedication,
      published_at = now(),
      updated_at = now()
  WHERE id = book_id AND senior_id = auth.uid()
  RETURNING senior_id, title INTO v_senior_id, v_title;

  IF v_senior_id IS NULL THEN
    RAISE EXCEPTION '책을 찾을 수 없거나 권한이 없습니다: %', book_id;
  END IF;

  -- 수락된 가족 전원에게 new_book 알림 발송
  FOR v_family IN
    SELECT family_id
    FROM family_links
    WHERE senior_id = v_senior_id
      AND invite_status = 'accepted'
  LOOP
    INSERT INTO notifications (recipient_id, type, title, body, reference_id, reference_type)
    VALUES (
      v_family.family_id,
      'new_book',
      v_title || ' 이 출간됐어요!',
      '새로운 이야기책을 읽어보세요.',
      book_id,
      'book'
    );
  END LOOP;
END;
$$;

-- RPC 함수 실행 권한 부여 (authenticated 롤 — RLS/SECURITY INVOKER로 접근 제어)
GRANT EXECUTE ON FUNCTION public.soft_delete_chapter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_chapter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_chapter_title(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_cover(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_book(uuid, text) TO authenticated;
