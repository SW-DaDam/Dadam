-- family_links 양방향 호칭 컬럼 추가
-- senior_title : 독자가 저자를 부르는 호칭 (예: 아빠, 할머니)
-- reader_nickname : 저자가 독자를 부르는 호칭 (예: 아들, 손녀)

ALTER TABLE family_links
  ADD COLUMN IF NOT EXISTS senior_title TEXT,
  ADD COLUMN IF NOT EXISTS reader_nickname TEXT;

-- 기존 데이터 마이그레이션:
-- 기존 relationship 값은 저자가 독자를 부르는 호칭이었으므로 reader_nickname으로 이전
UPDATE family_links
SET reader_nickname = relationship
WHERE reader_nickname IS NULL AND relationship IS NOT NULL;
