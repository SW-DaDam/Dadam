-- ============================================================
-- 010_book_generation_status.sql — book_generation_jobs 스키마 개선
-- 변경 내용:
--   1. job_status Enum 신규 생성 (파이프라인 단계 세분화)
--   2. book_generation_jobs.status TEXT → job_status Enum 교체
--   3. book_generation_jobs.senior_id 컬럼 추가 (job 중복 방지·조회용)
--   4. book_generation_jobs.book_id NULL 허용으로 변경
--      (pending 단계에서는 아직 books 레코드가 없으므로)
--   5. book_generation_jobs.stage_payload JSONB 추가
--      (단계 재시도 시 이전 단계 결과 보존용)
-- ============================================================

-- 1. 파이프라인 단계 Enum 생성
--    pending → aggregating → chaptering → cover_requested → done | failed
CREATE TYPE job_status AS ENUM (
  'pending',          -- pg_cron 트리거 직후, job만 생성된 상태
  'aggregating',      -- 해당 월 utterances 수집·선별 중
  'chaptering',       -- LLM으로 챕터 구성·서사 생성 중
  'cover_requested',  -- generate-cover Edge Function 호출 완료 (F-07 처리 중)
  'done',             -- 전체 파이프라인 완료
  'failed'            -- 임의 단계 실패 (error_log에 실패 단계 기록)
);

-- 2. status 컬럼 DEFAULT 제거 후 타입 변경
--    DEFAULT가 TEXT 타입으로 걸려 있으면 USING 캐스팅 전에 타입 충돌이 발생하므로
--    DROP DEFAULT → TYPE 변경 → SET DEFAULT 순서로 처리
ALTER TABLE public.book_generation_jobs
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE public.book_generation_jobs
  ALTER COLUMN status TYPE job_status
    USING status::job_status;

-- 3. status 컬럼 DEFAULT를 Enum 타입으로 재설정
ALTER TABLE public.book_generation_jobs
  ALTER COLUMN status SET DEFAULT 'pending'::job_status;

-- 4. book_id NULL 허용으로 변경
--    (pending 단계에서는 books 레코드 미생성 — chaptering 완료 후 채워짐)
ALTER TABLE public.book_generation_jobs
  ALTER COLUMN book_id DROP NOT NULL;

-- 5. senior_id 컬럼 추가
--    - 중복 job 방지 쿼리를 book_id 없이도 가능하게 함
--    - F-08 재시도 시 senior 기준 조회에 사용
ALTER TABLE public.book_generation_jobs
  ADD COLUMN IF NOT EXISTS senior_id UUID
    REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. stage_payload JSONB 컬럼 추가
--    - aggregating 결과(utterance ID 목록)를 저장해 chaptering 재시도 시 재수집 불필요
--    - chaptering 완료 후 book_id 임시 보관용으로도 활용
--    예시: { "aggregated_ids": ["uuid", ...], "book_id": "uuid" }
ALTER TABLE public.book_generation_jobs
  ADD COLUMN IF NOT EXISTS stage_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 7. senior_id + year/month 기준 중복 방지 인덱스
--    (동일 어르신의 동월 job이 done/processing 계열로 이미 있으면 skip 체크용)
CREATE INDEX IF NOT EXISTS idx_book_generation_jobs_senior_status
  ON public.book_generation_jobs(senior_id, status);
