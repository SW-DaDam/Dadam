-- ============================================================
-- 002_tables.sql — 테이블 생성 (FK 의존성 순)
-- 실행: Supabase MCP apply_migration
-- ============================================================

-- 1. profiles — auth.users 참조
CREATE TABLE public.profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role   NOT NULL,
  display_name TEXT        NOT NULL,
  avatar_url   TEXT        NULL,
  phone        TEXT        NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. senior_profiles — profiles 참조 (어르신 상세 프로필)
CREATE TABLE public.senior_profiles (
  id                   UUID        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_date           DATE        NULL,
  region               TEXT        NULL,
  dialect              TEXT        NULL,
  interests_summary    TEXT        NULL,
  onboarding_completed BOOLEAN     NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. family_links — 어르신-가족 연결 + 초대
CREATE TABLE public.family_links (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_id     UUID          NULL     REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code   TEXT          NOT NULL UNIQUE,
  invite_status invite_status NOT NULL DEFAULT 'pending',
  relationship  TEXT          NULL,
  invited_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  accepted_at   TIMESTAMPTZ   NULL,
  expires_at    TIMESTAMPTZ   NOT NULL,
  CONSTRAINT uq_family_link UNIQUE (senior_id, family_id)
);

-- 4. memories — 어르신 1명당 1행 (JSONB)
CREATE TABLE public.memories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id  UUID        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  data       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  version    INTEGER     NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. conversations — 대화 세션 메타데이터
CREATE TABLE public.conversations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ NULL,
  duration_seconds INTEGER     NULL,
  summary          TEXT        NULL,
  memory_extracted BOOLEAN     NOT NULL DEFAULT false,
  utterance_count  INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. utterances — 발화 단위
CREATE TABLE public.utterances (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID            NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  speaker         speaker_role    NOT NULL,
  content         TEXT            NOT NULL,
  tags            utterance_tag[] NOT NULL DEFAULT '{}',
  sequence_number INTEGER         NOT NULL,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- 7. books — 월간/단편 책
CREATE TABLE public.books (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  subtitle        TEXT        NULL,
  book_type       book_type   NOT NULL DEFAULT 'monthly',
  status          book_status NOT NULL DEFAULT 'draft',
  year            INTEGER     NOT NULL,
  month           INTEGER     NOT NULL,
  cover_image_url TEXT        NULL,
  dedication      TEXT        NULL,
  chapter_count   INTEGER     NOT NULL DEFAULT 0,
  published_at    TIMESTAMPTZ NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_monthly_book UNIQUE (senior_id, year, month)
);

-- 8. chapters — 주제 기반 챕터 (소프트 삭제)
CREATE TABLE public.chapters (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id              UUID        NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  title                TEXT        NOT NULL,
  theme                TEXT        NOT NULL,
  content              TEXT        NOT NULL,
  sort_order           INTEGER     NOT NULL DEFAULT 0,
  is_deleted           BOOLEAN     NOT NULL DEFAULT false,
  -- FK 없는 UUID 배열: 대화 삭제 후에도 챕터 유지 목적
  source_utterance_ids UUID[]      NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. comments — 가족 댓글
CREATE TABLE public.comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID        NOT NULL REFERENCES public.chapters(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. replies — 어르신 답글 (댓글당 1개 UNIQUE)
CREATE TABLE public.replies (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID        NOT NULL UNIQUE REFERENCES public.comments(id) ON DELETE CASCADE,
  senior_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  audio_url  TEXT        NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. cover_images — DALL-E 3 표지 후보
CREATE TABLE public.cover_images (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    UUID         NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  image_url  TEXT         NOT NULL,
  prompt     TEXT         NULL,
  status     cover_status NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 12. notifications — 다형성 알림
CREATE TABLE public.notifications (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id   UUID              NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           notification_type NOT NULL,
  title          TEXT              NOT NULL,
  body           TEXT              NULL,
  reference_id   UUID              NULL,
  reference_type TEXT              NULL,
  is_read        BOOLEAN           NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- 13. book_generation_jobs — F-08 재시도용 잡 상태 관리
CREATE TABLE public.book_generation_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID        NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  status      TEXT        NOT NULL DEFAULT 'pending',
  retry_count INTEGER     NOT NULL DEFAULT 0,
  error_log   TEXT        NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
