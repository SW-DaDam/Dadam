-- ============================================================
-- 20260518000001_short_book_schema.sql — F-18 단편 책 스키마
-- 변경 내용:
--   1. utterances.used_in_short_book_id 컬럼 추가
--      (단편 책에 사용된 발화 추적 — NULL이면 미사용)
--   2. books UNIQUE 제약 교체
--      uq_monthly_book(senior_id, year, month) → monthly 전용 partial unique index
--      (short 책은 같은 달에 여러 권 생성 가능)
-- ============================================================

-- 1. utterances: 단편 책 사용 추적 컬럼
-- ON DELETE SET NULL: 단편 책 삭제 시 발화는 미사용 상태로 복원
ALTER TABLE utterances
  ADD COLUMN used_in_short_book_id UUID
    REFERENCES books(id) ON DELETE SET NULL;

-- 조회 최적화 인덱스 (사용된 발화만 인덱싱)
CREATE INDEX idx_utterances_short_book
  ON utterances(used_in_short_book_id)
  WHERE used_in_short_book_id IS NOT NULL;

-- 2. books: monthly 전용 partial unique index로 교체
-- 삭제 대상 2개:
--   a) 002_tables.sql inline UNIQUE → Postgres 자동 이름 'books_senior_id_year_month_key'
--   b) 003_indexes.sql CREATE UNIQUE INDEX uq_monthly_book (이름이 다른 인덱스)
-- IF EXISTS: 라이브 DB 상태나 적용 순서에 따라 둘 중 하나만 존재할 수 있음
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_senior_id_year_month_key;
DROP INDEX IF EXISTS uq_monthly_book;

CREATE UNIQUE INDEX IF NOT EXISTS books_monthly_unique
  ON books(senior_id, year, month)
  WHERE book_type = 'monthly';
