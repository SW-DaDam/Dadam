# 역할 분담

> **문서 버전**: v2.0
> **작성일**: 2026-04-16
> **기준 문서**: PRD v2.3 / ERD v1.1 / tech-stack.md
> **프로젝트**: AI 말동무 기반 "가족 출판 플랫폼" (오브젠)
> **팀**: 권오인 + 이지형 (2인) / 9주 (2026.4.10 ~ 6.16)

---

## 1. 분담 원칙

1. **수직 슬라이싱** — 각 기능은 담당자가 프론트 + 백엔드(Edge Function/RLS/테이블)를 모두 작성
2. **기능별 브랜치 독립** — 각 기능을 `feature/*` 브랜치로 쪼개 병렬 개발 (협업 규칙은 [`docs/work/git-workflow.md`](./git-workflow.md) §1 참조)
3. **간섭 최소화** — 담당 폴더·테이블·Edge Function 디렉터리를 물리적으로 분리
4. **의존성은 명시적으로 표기** — 선행 기능이 필요한 경우 본 문서 §4에 기록

### 1.1 담당 축 요약

| 구분 | 권오인 | 이지형 |
|------|--------|--------|
| 주 도메인 | AI · 음성 · 백엔드 인프라 · LLM 파이프라인 | 시니어 UI · 책장 메타포 · 가족 커뮤니티 · Realtime 구독 |
| 전담 트랙 | PRD §4.2 AI 말동무(Track A) + §4.3 책 생성 AI(Track B 중 AI) + Whisper 파인튜닝 | PRD §4.3 책 편집 UI(Track B 중 UI) + §4.4 가족 커뮤니티(Track C) |
| 강점 | AI 튜닝 · Supabase 백엔드 · Edge Function | 프론트엔드 · UI/UX · 시니어 친화 디자인 |

---

## 2. 기능별 분담표

> PRD §4 기능 요구사항과 §10.1 MVP 12개 기능을 기준으로 재정의.
> **모든 기능은 수직 슬라이스** — 담당자가 해당 기능의 프론트/백엔드를 전부 구현.

### 👤 권오인 — AI / 음성 / 백엔드 인프라

| # | 기능 | PRD 참조 | 브랜치 |
|---|------|---------|--------|
| F-01 | 백엔드 기반 세팅 (Supabase 프로젝트·13 테이블·RLS·Storage 3 버킷·pg_cron·Realtime publication) | FR-1.1, FR-1.2 / ERD §2~§9 | `feature/backend-foundation` |
| F-02 | 카카오 OAuth 인증 + profiles/senior_profiles/memories 자동 생성 트리거 | FR-1.1 / ERD §9.2 | `feature/auth` |
| F-03 | AI 말동무 실시간 음성 대화 (Web Speech API STT/TTS + LLM Edge Function 스트리밍) | FR-2.1 | `feature/voice-chat` |
| F-04 | 관심사 메모리 추출·누적 (세션 종료 시 LLM이 memories.data JSONB 갱신) | FR-2.2 | `feature/memory-system` |
| F-05 | AI 기억 기반 선제 대화 + 발화 태그 분류 (utterances.tags 자동 부여) | FR-2.3, FR-2.4 | `feature/proactive-chat` |
| F-06 | 월말 책 초안 자동 생성 파이프라인 (book_generation_jobs 3단계: aggregating → chaptering → cover) | FR-3.1 | `feature/book-generation` |
| F-07 | DALL-E 3 표지 후보 생성 Edge Function (book-covers 버킷 저장) | FR-3.3 | `feature/cover-generation` |
| F-08 | 책 생성 실패 복구 (retry_count 자동 재시도 3회 + 수동 재시도 RPC) | FR-3.6 | `feature/book-retry` |
| F-09 | Whisper 파인튜닝 + Runpod Serverless 배포 (2~7주차 별도 트랙, MVP 후반 STT 교체) | tech-stack §Whisper 파인튜닝 / datasets.md | `feature/whisper-finetune` |

**담당 테이블**
- 전체 소유(쓰기 권한): `profiles`, `senior_profiles`, `memories`, `conversations`, `utterances`, `book_generation_jobs`, `cover_images`
- 쓰기 권한 필요(service_role): `books` INSERT, `chapters` INSERT, `notifications` INSERT (가족 알림 발송)

**담당 폴더**
```
supabase/
  migrations/            ← 13개 테이블 + RLS + 트리거 + Storage 버킷
  functions/
    voice-chat/          ← F-03 스트리밍 대화 프록시
    extract-memory/      ← F-04 메모리 추출
    tag-utterances/      ← F-05 발화 태그 분류
    generate-book/       ← F-06 책 생성 배치 (pg_cron 트리거)
    generate-cover/      ← F-07 DALL-E 3 호출
    retry-book-job/      ← F-08 수동 재시도

src/lib/ai/              ← Vercel AI SDK 래퍼 (ACTIVE_MODEL 전환)
src/hooks/
  useVoiceChat.ts        ← F-03 프론트 훅
  useAuth.ts             ← F-02
src/pages/
  auth/                  ← F-02 로그인/콜백
  chat/                  ← F-03 말동무 화면
  memory/                ← F-04 "내 이야기 메모" 화면

whisper/                 ← F-09 별도 디렉터리 (Colab 노트북, 전처리 스크립트)
```

---

### 👤 이지형 — UI / 시니어 프론트엔드 / 가족 커뮤니티

| # | 기능 | PRD 참조 | 브랜치 |
|---|------|---------|--------|
| F-10 | 프론트엔드 기반 세팅 (Vite 8 + Tailwind v4 + shadcn/ui + React Router v7 + PWA + 시니어 테마) | FR-1.3 / tech-stack §프론트엔드 | `feature/frontend-foundation` |
| F-11 | 가족 1:N 초대 (초대 코드 생성·수락 플로우, family_links 상태 관리) | FR-1.1 / ERD §10.1 | `feature/family-invite` |
| F-12 | 어르신 편집 UI (챕터 빼기·제목 바꾸기, 음성·버튼 "한 번에 하나" UI) | FR-3.2 | `feature/book-edit` |
| F-13 | 표지 선택 UI + 책 출간 승인 (헌사/에필로그 선택 입력 포함) | FR-3.3, FR-3.5 | `feature/book-publish` |
| F-14 | 가족 책장 UI (아날로그 책꽂이 메타포, 책 넘김 애니메이션) | FR-4.1 | `feature/family-bookshelf` |
| F-15 | 챕터 단위 댓글 + Supabase Realtime 구독 (모든 가족 공개) | FR-4.2 / ERD §8 | `feature/comments` |
| F-16 | 어르신 음성 답장 UI (reply-audio 업로드 + signed URL 재생) | FR-4.3 | `feature/voice-reply` |
| F-17 | 실시간 알림 UI (notifications Realtime 구독 + 읽음 처리) | FR-3.5 / ERD §8 | `feature/notifications-ui` |

**담당 테이블**
- 쓰기 권한: `family_links`(초대/수락), `comments`(가족 작성), `replies`(어르신 답글), `notifications`(is_read 업데이트)
- 읽기 + 제한적 쓰기: `books`(편집/출간 UPDATE), `chapters`(is_deleted/title UPDATE)

**담당 폴더**
```
src/pages/
  onboarding/            ← F-11 가족 초대 플로우
  bookshelf/             ← F-14 가족 책장
  book/
    [id]/
      read/              ← F-14 책 읽기 + F-15 댓글
      edit/              ← F-12 어르신 편집
      publish/           ← F-13 출간 승인

src/components/
  ui/                    ← shadcn 자동 생성 (직접 수정 최소)
  bookshelf/             ← 책꽂이·책 넘김
  chapter/               ← 챕터 뷰어·편집기
  comment/               ← 댓글·답글
  notifications/         ← 알림 드롭다운

src/hooks/
  useBookshelf.ts        ← F-14
  useComments.ts         ← F-15 Realtime 구독
  useVoiceReply.ts       ← F-16
  useNotifications.ts    ← F-17 Realtime 구독
  useInvite.ts           ← F-11

src/styles/              ← F-10 시니어 테마 (큰 글씨·고대비)
public/                  ← F-10 PWA 아이콘·매니페스트
```

---

## 3. 의존성 맵

### 3.1 선행 필수 관계

```
F-01 백엔드 기반  ─┐
                   ├── 모든 기능의 선행 조건
F-10 프론트 기반  ─┘
```

### 3.2 권오인 트랙 내부 의존성

```
F-02 인증 ──┬─> F-03 음성 대화 ──┬─> F-04 메모리 추출 ──> F-05 선제 대화·태그
            │                    │
            │                    └─> (발화 데이터 축적 → F-06 입력)
            │                              │
            │                              ▼
            └─> F-06 책 생성 파이프라인 ──> F-08 실패 복구
                         │
                         └─> F-07 표지 생성 (F-06의 cover 단계와 병렬)

F-09 Whisper 파인튜닝 (2~7주차, 독립 트랙)
     └─ 완료 후 F-03의 STT 부분만 교체 (인터페이스 동일)
```

### 3.3 이지형 트랙 내부 의존성

```
F-10 프론트 기반 ──┬─> F-11 가족 초대         (F-02 인증 필요)
                   │
                   ├─> F-14 가족 책장          (F-06 책 생성 + F-11 가족 연결 필요)
                   │         │
                   │         └─> F-15 댓글 ──> F-16 어르신 음성 답장
                   │
                   ├─> F-12 책 편집 UI         (F-06 책 초안 필요)
                   │         │
                   │         └─> F-13 표지 선택·출간  (F-07 표지 생성 필요)
                   │
                   └─> F-17 알림 UI            (F-01 notifications 테이블 필요)
```

### 3.4 교차 의존성 (권오인 → 이지형 handoff)

| 이지형 기능 | 선행 필요 (권오인) | 해결 방식 |
|-----------|------------------|----------|
| F-11 가족 초대 | F-02 인증 | auth 완성 직후 시작 |
| F-12 책 편집 | F-06 책 생성 | F-06 완료 전 **목업 데이터**(책 1권 + 챕터 3개)로 이지형 선제 작업 |
| F-13 표지 선택 | F-07 표지 생성 | 목업 이미지 3장으로 UI 선행 구현 |
| F-14 책장 | F-06 + F-11 | seed SQL로 목업 책 3권 제공 |
| F-15 댓글 | F-14 책장 | 이지형 트랙 내부, 순서대로 |
| F-17 알림 UI | F-01 notifications 테이블 | F-01 완료 시점에 테이블만 확보되면 진행 가능 |

**핵심 병목 2개**
1. **F-02 인증** — 이지형의 F-11이 막힘 → 권오인 초기 최우선 완료
2. **F-06 책 생성** — 이지형의 F-12·F-13·F-14 3개가 막힘 → **목업 데이터 선제 제공**으로 이지형 블로킹 해소

---

## 4. 연결 지점 — 인터페이스 약속

간섭 없이 병렬 개발하려면 다음 계약을 사전에 합의합니다.
**합의 시점**: F-01 / F-10 기반 세팅 직후, 기능 개발 시작 전 30분 미팅으로 확정.

### 4.1 타입 공유

| 항목 | 내용 | 담당 |
|------|------|------|
| `src/types/database.ts` | Supabase CLI `supabase gen types typescript` 자동 생성 → PR로 공유 | 권오인 생성, 이지형 import |
| `src/types/domain.ts` | 공통 도메인 타입 (`BookWithChapters`, `CommentWithReply` 등 join 결과) | 둘이 공동 편집 |

### 4.2 권오인이 제공하는 RPC / 함수

| RPC 함수 | 시그니처 | 사용처 |
|---------|---------|--------|
| `soft_delete_chapter(chapter_id uuid)` | void | F-12 어르신 편집 (되돌리기 가능) |
| `restore_chapter(chapter_id uuid)` | void | F-12 되돌리기 |
| `update_chapter_title(chapter_id uuid, new_title text)` | void | F-12 제목 바꾸기 |
| `select_cover(book_id uuid, cover_id uuid)` | void | F-13 표지 선택 → `books.cover_image_url` 업데이트 |
| `publish_book(book_id uuid, dedication text)` | void | F-13 출간 승인 + 가족 N명 notifications INSERT |
| `retry_book_generation(job_id uuid)` | void | F-08 수동 재시도 (이지형은 실패 상태 UI만) |
| `create_signed_reply_audio_url(reply_id uuid)` | text | F-16 재생 signed URL 발급(1시간) |

### 4.3 Realtime 채널 규약

| 채널명 | 대상 테이블 | 이벤트 | 용도 |
|--------|-----------|--------|------|
| `notifications:user:{user_id}` | notifications | INSERT | F-17 알림 실시간 수신 |
| `comments:chapter:{chapter_id}` | comments | INSERT, UPDATE | F-15 댓글 실시간 |
| `replies:comment:{comment_id}` | replies | INSERT | F-15/F-16 답글 실시간 |

### 4.4 Storage 경로 규칙

| 버킷 | 경로 규칙 | 업로드 주체 |
|------|----------|------------|
| `avatars` | `{user_id}/{timestamp}.{ext}` | 각 사용자 (이지형 UI) |
| `book-covers` | `{senior_id}/{book_id}/{cover_id}.webp` | 권오인 Edge Function (service_role) |
| `reply-audio` | `{senior_id}/{reply_id}.webm` | 어르신 (이지형 UI) |
| `tts-samples` | `{voice}_{speed}.mp3` (예: `shimmer_slow.mp3`) | 권오인 1회성 스크립트 (service_role), 18개 고정 |

### 4.5 목업 데이터 (권오인 선제 제공)

F-06이 완성되기 전 이지형이 UI 작업 가능하도록 seed SQL 제공:
- 어르신 1명, 가족 3명, family_links 수락 완료 상태
- 월간 책 3권 (draft 1 + editing 1 + published 1)
- 챕터 4개 × 각 책, 댓글 2개, 답글 1개
- 표지 후보 3장 (dummy 이미지 URL)
- 알림 5개 (읽음/미읽음 혼합)

파일: `supabase/seed.sql` — F-01 PR에 포함해 develop 머지 시 자동 반영.

---

## 5. 담당 매트릭스 (Ownership Matrix)

### 5.1 테이블 × 담당

| 테이블 | 쓰기 담당 | 읽기 담당 |
|--------|----------|----------|
| `profiles` | 권오인 (트리거 자동 생성) | 둘 다 |
| `senior_profiles` | 권오인 | 둘 다 |
| `family_links` | 이지형 | 둘 다 |
| `memories` | 권오인 (Edge Function) | 권오인 |
| `conversations` | 권오인 | 권오인 |
| `utterances` | 권오인 | 권오인 |
| `books` | 권오인(INSERT), 이지형(UPDATE 편집/출간) | 둘 다 |
| `chapters` | 권오인(INSERT), 이지형(UPDATE is_deleted/title) | 둘 다 |
| `comments` | 이지형 | 둘 다 |
| `replies` | 이지형 | 둘 다 |
| `cover_images` | 권오인 (Edge Function) | 둘 다 |
| `notifications` | 권오인(INSERT), 이지형(UPDATE is_read) | 둘 다 |
| `book_generation_jobs` | 권오인 (service_role) | 권오인 |

### 5.2 Edge Functions × 담당

| Edge Function | 담당 |
|---------------|------|
| `voice-chat` (LLM 스트리밍) | 권오인 |
| `extract-memory` (세션 종료 후) | 권오인 |
| `tag-utterances` (발화 태그 분류) | 권오인 |
| `generate-book` (월말 pg_cron 트리거) | 권오인 |
| `generate-cover` (DALL-E 3) | 권오인 |
| `retry-book-job` (수동 재시도) | 권오인 |

> MVP에서 이지형은 Edge Function을 새로 작성하지 않음. RPC 함수(§4.2)로 DB 조작.

---

## 6. 협업 규칙 요약

자세한 규칙은 [`docs/work/git-workflow.md`](./git-workflow.md) 참조.

- **브랜치**: `feature/*` (표 §2 참조) → `develop` PR → 상대방 리뷰 → 머지 → `develop` → `main`
- **커밋**: 한글 타입 컨벤션 (`feat: ~`, `fix: ~`)
- **PR**: 반드시 상대방 리뷰, 셀프 머지 금지
- **공통 약속 변경**: `src/types/*`, `supabase/migrations/*`, §4 인터페이스 변경 시 **PR에서 상대방 명시 멘션** 필수

---

## 7. Phase 2 / 향후 고도화

본 MVP에 포함되지 않음. 담당은 MVP 완료 후 재논의.
- 합본 자동 생성 (6개월/1년)
- 인쇄 제본 연동
- 가족 하이라이트 / 사진 첨부
- ElevenLabs TTS 고도화
- LLM 파인튜닝(문제 발생 시 한정)
