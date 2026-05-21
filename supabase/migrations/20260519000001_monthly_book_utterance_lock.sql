-- ============================================================
-- 20260519000001_monthly_book_utterance_lock.sql
-- 변경 내용:
--   utterances.used_in_monthly_book_id 컬럼 추가
--   월간 책 생성 시 사용된 발화를 잠가 단편 후보 풀에서 제외하기 위함
--   used_in_short_book_id와 동일한 패턴
-- ============================================================

-- ON DELETE SET NULL: 월간 책 삭제 시 발화는 미사용 상태로 복원
ALTER TABLE utterances
  ADD COLUMN used_in_monthly_book_id UUID
    REFERENCES books(id) ON DELETE SET NULL;

-- 조회 최적화 인덱스 (사용된 발화만 인덱싱)
CREATE INDEX idx_utterances_monthly_book
  ON utterances(used_in_monthly_book_id)
  WHERE used_in_monthly_book_id IS NOT NULL;
