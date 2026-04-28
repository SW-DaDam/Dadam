-- ============================================================
-- 001_enums.sql — Enum 타입 정의
-- 실행: Supabase MCP execute_sql
-- 형상관리용 (실제 실행은 MCP로)
-- ============================================================

-- 사용자 역할 구분 (어르신 / 가족)
CREATE TYPE user_role AS ENUM ('senior', 'family');

-- 가족 초대 상태
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');

-- 책 생명주기
CREATE TYPE book_status AS ENUM ('draft', 'editing', 'published');

-- 책 유형: 월간 정기 / 주제 단편 조기 출간
CREATE TYPE book_type AS ENUM ('monthly', 'short');

-- 발화 태그 분류 (AI 자동 태깅)
CREATE TYPE utterance_tag AS ENUM (
  'daily_mundane',      -- 일상 잡담 (책 제외 후보)
  'memory_recall',      -- 추억 회상
  'emotional_peak',     -- 감정 고조
  'philosophy',         -- 가치관/철학
  'relationship_event'  -- 관계 사건
);

-- 알림 유형
CREATE TYPE notification_type AS ENUM (
  'new_book',          -- 신간 출간
  'new_comment',       -- 새 댓글
  'new_reply',         -- 어르신 답글
  'invite_accepted',   -- 가족 초대 수락
  'book_draft_ready'   -- 책 초안 생성 완료
);

-- 표지 이미지 선택 상태
CREATE TYPE cover_status AS ENUM ('candidate', 'selected', 'rejected');

-- 대화 화자 구분
CREATE TYPE speaker_role AS ENUM ('senior', 'ai');
