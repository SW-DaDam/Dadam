-- F-04 메모리 구조 변경: 카테고리별 중첩 JSONB → LLM 자동분류 플랫 items 배열
-- 기존 데이터(hobbies, relationships 등)를 새 items 구조로 변환하여 보존

-- 기존 중첩 구조 → items 배열로 변환
-- 구조가 이미 items 배열이거나 null이면 건드리지 않음
UPDATE memories
SET data = (
  WITH src AS (SELECT data AS d FROM memories m2 WHERE m2.senior_id = memories.senior_id),
  converted AS (
    -- hobbies → 취미
    SELECT jsonb_build_object('text', v, 'category', '취미', 'emoji', '🌱') AS item
    FROM src, jsonb_array_elements_text(src.d->'hobbies') AS v
    UNION ALL
    -- philosophy → 가치관
    SELECT jsonb_build_object('text', v, 'category', '가치관', 'emoji', '💭')
    FROM src, jsonb_array_elements_text(src.d->'philosophy') AS v
    UNION ALL
    -- health → 건강
    SELECT jsonb_build_object('text', v, 'category', '건강', 'emoji', '💊')
    FROM src, jsonb_array_elements_text(src.d->'health') AS v
    UNION ALL
    -- recurring_topics → 일상
    SELECT jsonb_build_object('text', v, 'category', '일상', 'emoji', '🗣️')
    FROM src, jsonb_array_elements_text(src.d->'recurring_topics') AS v
    UNION ALL
    -- relationships → 가족 (이름 + 관계)
    SELECT jsonb_build_object(
      'text', key || CASE WHEN value->>'relation' IS NOT NULL THEN ' (' || (value->>'relation') || ')' ELSE '' END,
      'category', '가족',
      'emoji', '👨‍👩‍👧'
    )
    FROM src, jsonb_each(COALESCE(src.d->'relationships', '{}'::jsonb)) AS kv(key, value)
    UNION ALL
    -- emotional_patterns.happy_topics → 추억
    SELECT jsonb_build_object('text', v, 'category', '추억', 'emoji', '😊')
    FROM src, jsonb_array_elements_text(src.d->'emotional_patterns'->'happy_topics') AS v
    UNION ALL
    -- scheduled_events → 일상
    SELECT jsonb_build_object(
      'text', COALESCE(ev->>'event', ''),
      'category', '일상',
      'emoji', '📅'
    )
    FROM src, jsonb_array_elements(COALESCE(src.d->'scheduled_events', '[]'::jsonb)) AS ev
    WHERE ev->>'event' IS NOT NULL AND ev->>'event' != ''
  )
  SELECT jsonb_build_object('items', COALESCE(jsonb_agg(item), '[]'::jsonb))
  FROM converted
),
updated_at = now()
-- 이미 items 구조이면 건드리지 않음
WHERE data IS NOT NULL
  AND (data->'items') IS NULL;

-- items가 없던 row는 빈 배열로 초기화
UPDATE memories
SET data = '{"items": []}'::jsonb,
    updated_at = now()
WHERE data IS NULL;

-- remove_memory_item RPC: items 배열에서 text 기준으로 항목 제거
CREATE OR REPLACE FUNCTION remove_memory_item(
  p_senior_id uuid,
  p_text       text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != p_senior_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE memories
  SET data = jsonb_set(
    data,
    '{items}',
    COALESCE(
      (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(data->'items') AS elem
        WHERE elem->>'text' != p_text
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
  WHERE senior_id = p_senior_id;
END;
$$;

-- clear_all_memories RPC: items 배열을 빈 배열로 초기화
CREATE OR REPLACE FUNCTION clear_all_memories(
  p_senior_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() != p_senior_id THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  UPDATE memories
  SET data = '{"items": []}'::jsonb,
      updated_at = now()
  WHERE senior_id = p_senior_id;
END;
$$;
