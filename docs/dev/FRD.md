# 기능정의서_가족출판플랫폼

# 기능 정의서

## AI 말동무 기반 시니어 가족 출판 플랫폼

> **문서 버전**: v1.0
**기준 문서**: PRD v2.3 / ERD v1.1 / 역할분담서 v2.0
**작성일**: 2026-04-16
**프로젝트**: AI 말동무 기반 “가족 출판 플랫폼” (오브젠)
**팀**: 권오인 + 이지형 (2인) / 9주 (2026.4.10 ~ 6.16)
> 

## 1. 문서 개요

| 항목 | 내용 |
| --- | --- |
| 프로젝트명 | AI 말동무 기반 시니어 가족 출판 플랫폼 |
| 기업명 | 오브젠 |
| 팀원 | 권오인 (AI/음성/백엔드) + 이지형 (UI/UX/가족 커뮤니티) |
| 개발 기간 | 2026.04.10 ~ 2026.06.16 (9주) |
| 기준 문서 | PRD v2.3 / ERD v1.1 / 역할분담서 v2.0 |
| 총 기능 수 | 18개 (MVP 핵심 기능) |
| 기술 스택 | React 19 + Vite + TypeScript + Supabase + Vercel AI SDK + gpt-realtime-whisper (STT) + gpt-4o-mini-tts (TTS) + DALL-E 3 (Web Speech API fallback) |

### 1-1. 기능 트랙 구성

본 프로젝트의 18개 기능은 두 개의 병렬 트랙으로 분리 개발됩니다.

| 구분 | 권오인 트랙 (A + B-AI) | 이지형 트랙 (B-UI + C) |
| --- | --- | --- |
| 주 도메인 | AI · 음성 · 백엔드 인프라 · LLM 파이프라인 | 시니어 UI · 책장 메타포 · 가족 커뮤니티 · Realtime 구독 |
| 담당 기능 | F-01 ~ F-09, F-18 (10개) | F-10 ~ F-17 (8개) |
| 핵심 역량 | AI 튜닝 · Supabase 백엔드 · Edge Function | 프론트엔드 · UI/UX · 시니어 친화 디자인 |

---

## 2. 기능 목록 요약

### 2-1. 권오인 담당 기능 (F-01 ~ F-09)

| 기능 ID | 기능명 | 기능 구분 | 기능 설명 | 담당자 | 브랜치 |
| --- | --- | --- | --- | --- | --- |
| F-01 | 백엔드 기반 세팅 | 인프라 | 13개 테이블, RLS, Storage 버킷, pg_cron, Realtime publication 초기 구성 | 권오인 | `feature/backend-foundation` |
| F-02 | 카카오 OAuth 인증 | 인증/계정 | 카카오 OAuth 2.0 로그인 및 사용자 프로필 자동 생성 트리거 | 권오인 | `feature/auth` |
| F-03 | AI 말동무 실시간 음성 대화 | AI/음성 | OpenAI `gpt-realtime-whisper` STT + `gpt-4o-mini-tts` TTS + LLM Edge Function 스트리밍 실시간 대화 (Web Speech API fallback) / voice 6종·속도 3단계 어르신 설정 | 권오인 | `feature/voice-chat` |
| F-04 | 관심사 메모리 추출 & 누적 | AI | 세션 종료 시 LLM이 memories.data JSONB 자동 갱신 및 누적 저장 | 권오인 | `feature/memory-system` |
| F-05 | AI 선제 대화 & 발화 태그 분류 | AI | 기억 기반 선제 질문 생성 + utterances.tags 자동 분류 | 권오인 | `feature/proactive-chat` |
| F-06 | 월말 책 초안 자동 생성 | 책 생성 | 3단계 파이프라인(aggregating → chaptering → cover)으로 월간 책 초안 생성 | 권오인 | `feature/book-generation` |
| F-07 | AI 표지 이미지 생성 | 책 생성 | DALL-E 3 호출로 표지 후보 3~5장 생성 후 book-covers 버킷 저장 | 권오인 | `feature/cover-generation` |
| F-08 | 책 생성 실패 복구 | 안정성 | retry_count 자동 3회 재시도 + 수동 재시도 RPC | 권오인 | `feature/book-retry` |
| F-09 | Whisper 파인튜닝 검증 (포트폴리오용) | AI/음성 | 시니어 음성 데이터 LoRA 파인튜닝 결과 평가(CER 비교) — 실서비스는 순정 모델 사용 결정 | 권오인 | `feature/whisper-finetune` |
| F-18 | 외전(단편) 책 자동 생성 | 책 생성 | 누적 대화 중 단일 주제 2쪽 분량이 쌓이면 자동 태깅 후 단편 책 1챕터 생성 (월말 책과 별개 풀) | 권오인 | `feature/short-book` |

### 2-2. 이지형 담당 기능 (F-10 ~ F-17)

| 기능 ID | 기능명 | 기능 구분 | 기능 설명 | 담당자 | 브랜치 |
| --- | --- | --- | --- | --- | --- |
| F-10 | 프론트엔드 기반 세팅 | 인프라 | Vite 8 + Tailwind v4 + shadcn/ui + React Router v7 + PWA + 시니어 테마 | 이지형 | `feature/frontend-foundation` |
| F-11 | 가족 1:N 초대 | 가족 커뮤니티 | 초대 코드 생성·수락 플로우, family_links 상태 관리 | 이지형 | `feature/family-invite` |
| F-12 | 어르신 책 편집 UI | 책 편집 | 챕터 빼기·제목 바꾸기, 음성·버튼 기반 “한 번에 하나” 편집 UX | 이지형 | `feature/book-edit` |
| F-13 | 표지 선택 & 출간 승인 | 책 편집 | 표지 선택 UI + 헌사/에필로그 입력 + 출간 승인 플로우 | 이지형 | `feature/book-publish` |
| F-14 | 가족 책장 UI | 가족 커뮤니티 | 아날로그 책꽂이 메타포, 책 넘김 애니메이션, 월별 책 아카이브 | 이지형 | `feature/family-bookshelf` |
| F-15 | 챕터 댓글 (Realtime) | 가족 커뮤니티 | 챕터 단위 댓글 작성 + Supabase Realtime 구독 (가족 전체 공개) | 이지형 | `feature/comments` |
| F-16 | 어르신 음성 답장 | 가족 커뮤니티 | 어르신 음성 녹음 업로드 + signed URL 재생 | 이지형 | `feature/voice-reply` |
| F-17 | 실시간 알림 UI | 알림 | notifications Realtime 구독 + 읽음 처리 UI | 이지형 | `feature/notifications-ui` |

---

## 3. 기능 상세 정의

각 기능의 PRD 참조, 담당자, 기능 설명, 입력/출력 조건, 예외 처리, 관련 테이블, 브랜치를 정의합니다.

---

### F-01. 백엔드 기반 세팅

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-01 |
| **기능명** | 백엔드 기반 세팅 |
| **PRD 참조** | FR-1.1, FR-1.2 / ERD §2~§9 |
| **담당자** | 권오인 |
| **기능 구분** | 인프라 |
| **브랜치** | `feature/backend-foundation` |

**기능 설명**
- Supabase 프로젝트 초기화 및 13개 테이블 생성 (`profiles`, `senior_profiles`, `family_links`, `memories`, `conversations`, `utterances`, `books`, `chapters`, `comments`, `replies`, `cover_images`, `notifications`, `book_generation_jobs`)
- Row Level Security(RLS) 정책 전체 테이블 적용
- Storage 버킷 3개(`avatars`, `book-covers`, `reply-audio`) 생성 및 접근 권한 설정
- pg_cron 익스텐션 설정 및 월말 책 생성 스케줄 등록
- Realtime publication 설정 (`notifications`, `comments`, `replies` 테이블)
- `seed.sql` 제공: 어르신 1명, 가족 3명, 목업 책 3권, 챕터, 댓글, 알림 데이터

**입력 조건**
- Supabase 프로젝트 URL 및 서비스 키
- 테이블 스키마 정의서(ERD v1.1)

**출력 / 결과**
- 13개 테이블 생성 완료
- RLS 정책 적용 완료
- Storage 버킷 생성 완료
- `seed.sql` 실행 완료 (개발 환경)

**예외 처리**
- 마이그레이션 실패 시 롤백 스크립트 실행
- RLS 정책 누락 시 service role로 임시 접근 허용 후 보완

**관련 테이블**: `profiles`, `senior_profiles`, `family_links`, `memories`, `conversations`, `utterances`, `books`, `chapters`, `comments`, `replies`, `cover_images`, `notifications`, `book_generation_jobs`

---

### F-02. 카카오 OAuth 인증

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-02 |
| **기능명** | 카카오 OAuth 인증 |
| **PRD 참조** | FR-1.1 / ERD §9.2 |
| **담당자** | 권오인 |
| **기능 구분** | 인증/계정 |
| **브랜치** | `feature/auth` |

**기능 설명**
- 카카오 OAuth 2.0 기반 소셜 로그인 페이지 개발
- 로그인 성공 시 Supabase Auth 세션 생성 및 `profiles` 레코드 자동 생성 트리거 실행
- `senior_profiles` 및 `memories` 초기 레코드 자동 생성
- 역할(어르신/가족) 구분 온보딩 플로우 연동
- JWT 토큰 기반 세션 관리 및 자동 갱신

**입력 조건**
- 카카오 인가 코드 (OAuth callback)
- 사용자 역할 선택 (어르신/가족)

**출력 / 결과**
- Supabase 세션 토큰
- `profiles` 레코드 생성
- `senior_profiles` 및 `memories` 초기 레코드 생성

**예외 처리**
- 카카오 서버 오류 시 재시도 안내 메시지 표시
- 기존 가입 사용자는 로그인만 처리 (중복 생성 방지)
- 토큰 만료 시 자동 재발급 처리

**관련 테이블**: `profiles`, `senior_profiles`, `memories`

---

### F-03. AI 말동무 실시간 음성 대화

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-03 |
| **기능명** | AI 말동무 실시간 음성 대화 |
| **PRD 참조** | FR-2.1 |
| **담당자** | 권오인 |
| **기능 구분** | AI/음성 |
| **브랜치** | `feature/voice-chat` |

**기능 설명**
- **STT**: OpenAI `gpt-realtime-whisper` REST batch 방식 — `stt-whisper` Edge Function 경유
  - 클라이언트 MediaRecorder로 녹음한 Blob을 multipart/form-data로 전송 → 텍스트 변환
  - 1차 실패 시 Web Speech API SpeechRecognition으로 자동 fallback
- **TTS**: OpenAI `gpt-4o-mini-tts` — `tts-openai` Edge Function 경유, MP3 스트림 반환
  - 어르신 voice 6종 (`shimmer`·`nova`·`coral`·`onyx`·`echo`·`sage`) + 속도 3단계 (`slow`·`normal`·`fast`) 개인화
  - 1차 실패 시 Web Speech API SpeechSynthesis로 자동 fallback
- Vercel AI SDK를 통한 LLM Edge Function 스트리밍 응답 처리
- 대화 내용을 `conversations` / `utterances` 테이블에 실시간 저장
- 마이크 애니메이션으로 대화 중/대기 중 상태 시각 피드백 제공
- MVP: Gemini 1.5 Flash / 상용: GPT-4o (`ACTIVE_MODEL` 환경변수로 전환)
- 어르신 TTS 설정 페이지(`/s/settings/voice`): voice 6개 카드 + 속도 3단계 + Storage 샘플 미리듣기 + DB 저장

**입력 조건**
- 어르신 음성 입력 (마이크 → MediaRecorder Blob)
- 이전 대화 컨텍스트
- `memories` 테이블의 관심사 프로필
- `senior_profiles.tts_voice` / `senior_profiles.tts_speed` (마운트 시 1회 로드·캐시)
- 환경변수: `OPENAI_API_KEY` (STT + TTS + LLM 공통)

**출력 / 결과**
- STT 변환 텍스트
- AI 텍스트 응답 (스트리밍)
- TTS 음성 재생 (MP3 Blob URL → `<audio>` 재생)
- `utterances` 레코드 저장

**예외 처리**
- 마이크 권한 거부 시 권한 요청 안내
- STT Edge Function 실패 시 Web Speech API SpeechRecognition으로 자동 fallback
- TTS Edge Function 실패 시 Web Speech API SpeechSynthesis로 자동 fallback
- MediaRecorder 미지원 환경 → 즉시 Web Speech STT 경로로 분기, 에러 없음

**관련 테이블**: `conversations`, `utterances`

---

### F-04. 관심사 메모리 추출 & 누적

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-04 |
| **기능명** | 관심사 메모리 추출 & 누적 |
| **PRD 참조** | FR-2.2 |
| **담당자** | 권오인 |
| **기능 구분** | AI |
| **브랜치** | `feature/memory-system` |

**기능 설명**
- 세션 종료 시 해당 대화 `utterances`를 LLM으로 분석
- 취미·추억·가족관계·철학 카테고리별 관심사 자동 추출
- `memories.data` JSONB 필드에 카테고리별 누적 갱신 (덮어쓰기 아닌 병합)
- “내 이야기 메모” 화면에서 어르신이 저장된 기억 확인 가능

**입력 조건**
- 세션 `utterances` 데이터
- 기존 `memories.data` JSONB

**출력 / 결과**
- 갱신된 `memories.data` (카테고리별 관심사 누적)
- 어르신 메모리 뷰 화면 반영

**예외 처리**
- 추출 실패 시 기존 `memories` 보존 (무중단)
- LLM 응답 파싱 오류 시 원본 텍스트 임시 저장

**관련 테이블**: `memories`, `utterances`

---

### F-05. AI 기억 기반 선제 대화 & 발화 태그 분류

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-05 |
| **기능명** | AI 기억 기반 선제 대화 & 발화 태그 분류 |
| **PRD 참조** | FR-2.3, FR-2.4 |
| **담당자** | 권오인 |
| **기능 구분** | AI |
| **브랜치** | `feature/proactive-chat` |

**기능 설명**
- 대화 시작 시 `memories` 프로필 기반 어르신 맞춤 선제 질문 자동 생성 (예: “지난주 토마토 수확하셨다고 하셨는데, 맛있었어요?”)
- 발화(`utterances`)에 감정·주제·중요도 태그 자동 부여 (`utterances.tags` 컬럼)
- 태그 데이터는 F-06 책 초안 생성 시 핵심 에피소드 선별 기준으로 활용

**입력 조건**
- `memories.data` 관심사 프로필
- 최근 `utterances` 목록

**출력 / 결과**
- 선제 질문 텍스트
- `utterances.tags` 배열 업데이트

**예외 처리**
- `memories` 데이터 부족 시 기본 일상 질문으로 대체
- 태그 분류 실패 시 기본 태그(`general`) 부여

**관련 테이블**: `memories`, `utterances`

---

### F-06. 월말 월간 책 초안 자동 생성

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-06 |
| **기능명** | 월말 월간 책 초안 자동 생성 |
| **PRD 참조** | FR-3.1 |
| **담당자** | 권오인 |
| **기능 구분** | 책 생성 |
| **브랜치** | `feature/book-generation` |

**기능 설명**
- pg_cron 스케줄러가 매월 마지막 날 `generate-book` Edge Function 호출
- 3단계 파이프라인 실행: ① aggregating(발화 수집) → ② chaptering(챕터 분류·선별) → ③ cover(표지 생성 요청)
- 감정 강도·반복 빈도·서사성 기준으로 핵심 이야기(전체의 10~20%) 선별하여 챕터 구성
- `book_generation_jobs` 테이블로 각 단계 상태 관리 (`pending` → `processing` → `done` / `failed`)
- 초안 완성 시 어르신에게 알림 발송

**입력 조건**
- 해당 월 `utterances` 전체 데이터
- `memories` 프로필
- `book_generation_jobs` 레코드

**출력 / 결과**
- `books` 레코드 (`draft` 상태) INSERT
- `chapters` 레코드 INSERT
- 어르신 알림(`notifications`) INSERT

**예외 처리**
- F-08 실패 복구 연동: 실패 시 `retry_count` +1, 최대 3회 자동 재시도
- 3회 실패 시 수동 재시도 버튼 활성화

**관련 테이블**: `books`, `chapters`, `book_generation_jobs`, `notifications`, `utterances`

---

### F-07. DALL-E 3 표지 후보 생성

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-07 |
| **기능명** | DALL-E 3 표지 후보 생성 |
| **PRD 참조** | FR-3.3 |
| **담당자** | 권오인 |
| **기능 구분** | 책 생성 |
| **브랜치** | `feature/cover-generation` |

**기능 설명**
- F-06 chaptering 완료 후 이달의 핵심 키워드 3~5개 추출
- DALL-E 3 API 호출로 표지 이미지 후보 3~5장 생성
- 생성된 이미지를 `book-covers` 버킷에 WebP 형식으로 저장
- `cover_images` 테이블에 메타데이터(`book_id`, 이미지 URL, 키워드) 저장

**입력 조건**
- 챕터 핵심 키워드
- `book_id`
- `senior_id`

**출력 / 결과**
- `cover_images` 레코드 3~5건 INSERT
- `book-covers` 버킷 이미지 파일

**예외 처리**
- DALL-E API 오류 시 기본 템플릿 표지 3종 fallback 제공
- 생성 소요 시간이 길 경우 비동기 처리 후 알림

**관련 테이블**: `cover_images`, `books`

---

### F-08. 책 생성 실패 복구

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-08 |
| **기능명** | 책 생성 실패 복구 |
| **PRD 참조** | FR-3.6 |
| **담당자** | 권오인 |
| **기능 구분** | 안정성 |
| **브랜치** | `feature/book-retry` |

**기능 설명**
- `book_generation_jobs` 상태 모니터링 및 `failed` 감지 시 자동 재시도
- `retry_count` 최대 3회 자동 재시도 (지수 백오프 적용)
- 3회 초과 실패 시 수동 재시도 RPC(`retry_book_generation`) 제공
- 이지형: 실패 상태 표시 UI + 수동 재시도 버튼만 구현

**입력 조건**
- `book_generation_jobs.job_id`
- `retry_count` 현재값

**출력 / 결과**
- 재시도 실행 및 상태 업데이트
- 최종 실패 시 어르신·관리자 알림

**예외 처리**
- 재시도 중 중복 실행 방지를 위한 잠금 처리
- 데이터 일관성 보장을 위한 트랜잭션 처리

**관련 테이블**: `book_generation_jobs`, `notifications`

---

### F-09. Whisper 파인튜닝 검증 (포트폴리오용)

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-09 |
| **기능명** | Whisper 파인튜닝 검증 (포트폴리오용) |
| **PRD 참조** | tech-stack §Whisper 파인튜닝 / datasets.md |
| **담당자** | 권오인 |
| **기능 구분** | AI/음성 (검증·연구 트랙) |
| **브랜치** | `feature/whisper-finetune` |

**기능 설명**
- 한국어 시니어 음성 데이터셋 수집 및 전처리 (`datasets.md` 참조)
- OpenAI Whisper LoRA 파인튜닝 (Colab Pro+ 환경, 2~6주차 독립 트랙)
- 파인튜닝 결과 vs 순정 모델(`whisper-large-v3-turbo`) CER/WER 비교 평가
- **검증 결과(2026-05-18)**: 파인튜닝 모델 CER 9% vs 순정 모델 CER 6%로 순정이 우수
- **실서비스 연동 결정**: 파인튜닝 모델 미사용, F-03 STT는 순정 `whisper-large-v3-turbo` API 직접 호출로 진행
- 파인튜닝 노트북·평가 그래프·CER 리포트는 `whisper/` 디렉터리에 포트폴리오 자료로 보존 (Runpod 배포는 폐기)

**입력 조건**
- 한국어 시니어 음성 WAV 파일 (AI Hub 107·94·543·71703 등)
- 전처리 스크립트 (`whisper/` 디렉터리)

**출력 / 결과**
- 파인튜닝된 Whisper 모델 가중치 (`whisper/checkpoints/`)
- CER/WER 비교 평가 리포트 (포트폴리오용)
- F-03 STT 모듈 결정: **순정 `whisper-large-v3-turbo` API 사용** (F-09 모델 미연동)

**예외 처리**
- 본 기능은 검증·연구 트랙이므로 실서비스 장애 영향 없음
- 향후 데이터셋 확장 시 재학습 가능하도록 노트북·전처리 스크립트는 재사용 가능 형태로 보존

**관련 테이블**: 별도 `datasets.md` 관리 (DB 테이블 불필요)

---

### F-10. 프론트엔드 기반 세팅

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-10 |
| **기능명** | 프론트엔드 기반 세팅 |
| **PRD 참조** | FR-1.3 / tech-stack §프론트엔드 |
| **담당자** | 이지형 |
| **기능 구분** | 인프라 |
| **브랜치** | `feature/frontend-foundation` |

**기능 설명**
- Vite 8 + TypeScript + React Router v7 프로젝트 초기 구성
- Tailwind v4 + shadcn/ui 컴포넌트 라이브러리 설정
- PWA 매니페스트·서비스워커 설정 (앱 설치 없이 브라우저로 접근)
- 시니어 특화 테마 설정: 큰 버튼(최소 48px), 고대비 색상, 다크모드, 글씨 크기 조절
- 마이크 애니메이션 기본 컴포넌트 구현

**입력 조건**
- `tech-stack.md` 기술 스펙
- 시니어 UX 가이드라인

**출력 / 결과**
- 프로젝트 기반 구조
- `src/styles/` 시니어 테마
- `public/` PWA 아이콘·매니페스트

**예외 처리**
- shadcn 자동 생성 파일 직접 수정 최소화
- PWA 서비스워커 캐시 전략 문서화

**관련 테이블**: 테이블 불필요 (프론트엔드 기반)

---

### F-11. 가족 1:N 초대

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-11 |
| **기능명** | 가족 1:N 초대 |
| **PRD 참조** | FR-1.1 / ERD §10.1 |
| **담당자** | 이지형 |
| **기능 구분** | 가족 커뮤니티 |
| **브랜치** | `feature/family-invite` |

**기능 설명**
- 어르신이 카카오 링크 기반 초대 코드 생성 및 공유
- 가족이 초대 링크 접속 시 카카오 로그인 후 `family_links` 레코드 `pending` 생성
- 어르신 수락 시 `family_links.status = accepted` 업데이트
- 형제끼리 댓글 공유로 가족 내 자연스러운 대화 활성화

**입력 조건**
- 어르신 `user_id`
- 초대 수락 가족의 카카오 계정

**출력 / 결과**
- 초대 코드 (URL)
- `family_links` 레코드 생성/수락
- 어르신 수락 알림

**예외 처리**
- 초대 코드 만료(24시간) 시 재생성 안내
- 이미 연결된 가족 재초대 방지 처리

**관련 테이블**: `family_links`, `notifications`

---

### F-12. 어르신 책 편집 UI

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-12 |
| **기능명** | 어르신 책 편집 UI |
| **PRD 참조** | FR-3.2 |
| **담당자** | 이지형 |
| **기능 구분** | 책 편집 |
| **브랜치** | `feature/book-edit` |

**기능 설명**
- 챕터 목록 표시 및 음성 또는 큰 버튼으로 챕터 빼기·되돌리기 조작 (“한 번에 하나” UX 원칙)
- 챕터 제목 음성 또는 버튼 입력으로 변경
- 에필로그·헌사 추가 입력 인터페이스
- 변경 사항 실시간 미리보기 제공
- RPC 호출: `soft_delete_chapter` / `restore_chapter` / `update_chapter_title`

**입력 조건**
- `books.id` (`draft` 상태)
- `chapters` 목록

**출력 / 결과**
- `chapters.is_deleted` / `title` 업데이트
- 편집 완료 후 표지 선택(F-13) 화면으로 이동

**예외 처리**
- F-06 초안 미생성 상태에서는 편집 화면 접근 불가 처리
- 음성 인식 실패 시 버튼 대체 입력 자동 전환

**관련 테이블**: `books`, `chapters`

---

### F-13. 표지 선택 & 출간 승인

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-13 |
| **기능명** | 표지 선택 & 출간 승인 |
| **PRD 참조** | FR-3.3, FR-3.5 |
| **담당자** | 이지형 |
| **기능 구분** | 책 편집 |
| **브랜치** | `feature/book-publish` |

**기능 설명**
- 4단계 step UI로 진행 (Step 1 표지 선택 → Step 2 제목 확인 → Step 3 작가의 말(헌사) → Step 4 최종 출간)
- Step 1: F-07이 생성한 표지 후보 3~5장을 큰 이미지로 표시하여 어르신이 선택
- Step 3 작가의 말(`dedication`) 입력:
  - 텍스트 키보드 입력 + **마이크 버튼 음성 녹음** 두 가지 입력 방식 제공
  - 마이크 녹음 시 F-03 STT 인프라(Whisper API) 재사용으로 텍스트 변환
  - 녹음 중 시각 피드백(파형/타이머) + 변환 결과 미리보기 + 재녹음 가능
- Step 4 출간 승인 버튼 클릭 시 `publish_book` RPC 호출
- 출간 완료 시 가족 N명 전체에게 알림 자동 발송 (RPC 내부 처리)
- 출간된 책은 가족 책장(F-14)에 즉시 반영

**입력 조건**
- `cover_images` 목록
- 헌사: 텍스트(키보드) 또는 녹음 파일(마이크 → STT 변환 결과)
- `book_id`

**출력 / 결과**
- `books.status = published` 업데이트
- `books.cover_image_url` 업데이트
- `books.dedication` 업데이트 (텍스트 또는 STT 변환 텍스트)
- 가족 전체 `notifications` INSERT

**예외 처리**
- 표지 로딩 실패 시 기본 표지 fallback 표시
- 마이크 권한 거부 또는 STT 인식 실패 시 텍스트 입력으로 자동 fallback
- 출간 승인 후 취소 불가 안내 모달 표시

**관련 테이블**: `books`, `cover_images`, `notifications`

---

### F-14. 가족 책장 UI

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-14 |
| **기능명** | 가족 책장 UI |
| **PRD 참조** | FR-4.1 |
| **담당자** | 이지형 |
| **기능 구분** | 가족 커뮤니티 |
| **브랜치** | `feature/family-bookshelf` |

**기능 설명**
- 월별 책이 책장에 꽂히는 아날로그 책꽂이 메타포 UI 구현
- 책 넘김 애니메이션으로 자연스러운 읽기 경험 제공
- 책 목록에 조회수·댓글 수 표시
- 책 클릭 시 챕터 목록 진입 및 챕터 본문 읽기 화면 전환
- `published` 상태 책만 가족에게 표시 (`draft` / `editing`은 어르신만 접근)

**입력 조건**
- `family_links`로 연결된 어르신 `books` 목록 (`published`)
- `cover_image_url`

**출력 / 결과**
- 책장 UI 렌더링
- 책 상세/챕터 읽기 화면 라우팅

**예외 처리**
- 출간된 책이 없을 경우 “아직 책이 없어요” 빈 상태 화면 표시
- 이미지 로딩 실패 시 기본 표지 대체

**관련 테이블**: `books`, `chapters`, `family_links`

---

### F-15. 챕터 댓글 (Realtime)

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-15 |
| **기능명** | 챕터 댓글 (Realtime) |
| **PRD 참조** | FR-4.2 / ERD §8 |
| **담당자** | 이지형 |
| **기능 구분** | 가족 커뮤니티 |
| **브랜치** | `feature/comments` |

**기능 설명**
- 챕터 단위 댓글 작성 (텍스트, 가족 전체 공개)
- Supabase Realtime 구독으로 신규 댓글 실시간 반영
- 댓글 작성 시 어르신에게 알림 발송
- 어르신 음성 답장(F-16) 연동: 댓글에 답글 아이콘 및 음성 재생 버튼 표시
- 가족 전체 공개 댓글로 형제끼리 자연스러운 대화 활성화

**입력 조건**
- `chapter_id`
- 댓글 텍스트
- 작성자 `user_id`

**출력 / 결과**
- `comments` 레코드 INSERT
- 어르신 알림(`notifications`) INSERT
- Realtime 이벤트 수신 UI 갱신

**예외 처리**
- Realtime 연결 끊김 시 폴링 fallback 적용
- 빈 댓글 입력 방지 클라이언트 유효성 검사

**관련 테이블**: `comments`, `notifications`

---

### F-16. 어르신 음성 답장

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-16 |
| **기능명** | 어르신 음성 답장 |
| **PRD 참조** | FR-4.3 |
| **담당자** | 이지형 |
| **기능 구분** | 가족 커뮤니티 |
| **브랜치** | `feature/voice-reply` |

**기능 설명**
- 어르신이 댓글에 대해 음성 녹음으로 답장 가능 (Web Speech API 또는 MediaRecorder)
- 녹음 파일을 `reply-audio` 버킷에 WebM 형식으로 업로드
- `replies` 레코드 INSERT 및 signed URL 생성 (1시간 유효)
- 가족이 댓글 답장 음성 재생 버튼으로 어르신 목소리 청취
- 음성 답장 등록 시 해당 댓글 작성 가족에게 알림 발송

**입력 조건**
- `comment_id`
- 음성 녹음 WebM Blob
- `senior_id`

**출력 / 결과**
- `reply-audio` 버킷 파일 저장
- `replies` 레코드 INSERT
- signed URL 반환
- 가족 알림 INSERT

**예외 처리**
- 마이크 권한 거부 시 텍스트 답장 대체 입력 제공
- 업로드 실패 시 로컬 임시 저장 후 재시도 안내

**관련 테이블**: `replies`, `notifications`

---

### F-17. 실시간 알림 UI

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-17 |
| **기능명** | 실시간 알림 UI |
| **PRD 참조** | FR-3.5 / ERD §8 |
| **담당자** | 이지형 |
| **기능 구분** | 알림 |
| **브랜치** | `feature/notifications-ui` |

**기능 설명**
- Supabase Realtime으로 `notifications` 테이블 구독, 신규 알림 즉시 수신
- 알림 드롭다운 UI: 읽음/미읽음 구분, 알림 클릭 시 해당 화면으로 딥링크
- 알림 읽음 처리 (`notifications.is_read = true` UPDATE)
- 알림 유형: 댓글 등록 / 음성 답장 / 책 출간 완료 / 가족 초대 수락

**입력 조건**
- `user_id`
- `notifications` 테이블 Realtime 이벤트

**출력 / 결과**
- 알림 뱃지 카운트 업데이트
- 알림 목록 UI 렌더링
- `notifications.is_read` 업데이트

**예외 처리**
- Realtime 연결 실패 시 주기적 폴링 fallback (30초 간격)
- 알림 수 100개 초과 시 페이지네이션 처리

**관련 테이블**: `notifications`

---

### F-18. 외전(단편) 책 자동 생성

| 항목 | 내용 |
| --- | --- |
| **기능 ID** | F-18 |
| **기능명** | 외전(단편) 책 자동 생성 |
| **PRD 참조** | FR-3.4 조기 출간 |
| **담당자** | 권오인 |
| **기능 구분** | 책 생성 |
| **브랜치** | `feature/short-book` |

**기능 설명**
- 매 발화 태깅(F-05) 직후 또는 별도 배치 사이클로, 누적된 `utterances` 중 단일 주제(예: 특정 사건·인물·시기)에 대해 단편 책 2쪽 분량을 채울 수 있는지 LLM이 판단
- 조건 충족 시 해당 발화들에 `short_book_candidate` 태그 부여 + `book_generation_jobs` 신규 레코드 생성 (`book_type = 'short'`)
- `generate-book` Edge Function 재사용 (분기 파라미터: `chapter_count = 1`, `target_pages = 2`)
- `generate-cover` Edge Function · 프롬프트 그대로 재사용 (book 단위로 호출되므로 책 종류와 무관)
- **월말 책(F-06, `book_type='monthly'`)과 별개 추출 풀**: 외전으로 사용된 발화는 월말 책 후보군에서 자동 제외하지 않으나(읽혀도 무방), 동일 주제 중복 생성은 방지
- 생성 완료 시 어르신에게 알림(`notification_type = 'book_draft_ready'`)
- 편집(F-12) · 표지 선택 · 출간(F-13) 플로우는 월말 책과 동일하게 적용

**입력 조건**
- 누적 `utterances` (현재 미사용/일부 사용된 발화 풀, 태그 무관)
- `memories` 프로필 (주제 판단 컨텍스트)
- 직전 생성 이력 (동일 주제 중복 방지용 비교 키)

**출력 / 결과**
- `books` 레코드 (`book_type='short'`, `status='draft'`) 1건 INSERT
- `chapters` 레코드 1건 INSERT (`target_pages ≈ 2`)
- `cover_images` 레코드 3~5건 INSERT
- 어르신 알림(`notifications`) INSERT
- 후보 발화에 `short_book_candidate` 태그 부여 (`utterances.tags` 배열)

**예외 처리**
- 주제 판단 실패 시 태그 미부여 + job 미생성 → 다음 사이클 재평가
- 발화 수 부족(2쪽 분량 미달) 시 생성 보류
- 동일/유사 주제 중복 생성 방지: 최근 N건 외전 책의 `topic_hash` 또는 `subtitle` 비교
- F-08 실패 복구 로직 공통 적용 (`retry_count` 자동 3회 재시도)

**관련 테이블**: `books`, `chapters`, `book_generation_jobs`, `cover_images`, `utterances`, `notifications`

---

## 4. 인터페이스 약속 (교차 담당 연결 지점)

두 담당자 간 간섭 없는 병렬 개발을 위해 사전 합의된 계약입니다.
**합의 시점**: F-01 / F-10 기반 세팅 완료 직후 30분 미팅으로 확정.

### 4-1. 권오인이 제공하는 RPC 함수

| RPC 함수명 | 시그니처 | 용도 | 사용 기능 |
| --- | --- | --- | --- |
| `soft_delete_chapter` | `(chapter_id uuid) → void` | 챕터 소프트 삭제 (되돌리기 가능) | F-12 |
| `restore_chapter` | `(chapter_id uuid) → void` | 소프트 삭제 챕터 복원 | F-12 |
| `update_chapter_title` | `(chapter_id uuid, new_title text) → void` | 챕터 제목 변경 | F-12 |
| `select_cover` | `(book_id uuid, cover_id uuid) → void` | 표지 선택 → `books.cover_image_url` 업데이트 | F-13 |
| `publish_book` | `(book_id uuid, dedication text) → void` | 출간 승인 + 가족 알림 INSERT | F-13 |
| `retry_book_generation` | `(job_id uuid) → void` | 책 생성 수동 재시도 | F-08 |
| `create_signed_reply_audio_url` | `(reply_id uuid) → text` | 음성 답장 signed URL 발급 (1시간) | F-16 |

### 4-2. Realtime 채널 규약

| 채널명 | 대상 테이블 | 이벤트 | 용도 |
| --- | --- | --- | --- |
| `notifications:user:{user_id}` | `notifications` | INSERT | F-17 알림 실시간 수신 |
| `comments:chapter:{chapter_id}` | `comments` | INSERT, UPDATE | F-15 댓글 실시간 |
| `replies:comment:{comment_id}` | `replies` | INSERT | F-15/F-16 답글 실시간 |

### 4-3. Storage 버킷 경로 규칙

| 버킷 | 경로 규칙 | 업로드 주체 |
| --- | --- | --- |
| `avatars` | `{user_id}/{timestamp}.{ext}` | 각 사용자 (이지형 UI) |
| `book-covers` | `{senior_id}/{book_id}/{cover_id}.webp` | 권오인 Edge Function (service_role) |
| `reply-audio` | `{senior_id}/{reply_id}.webm` | 어르신 (이지형 UI) |

### 4-4. 타입 공유

| 파일 | 내용 | 담당 |
| --- | --- | --- |
| `src/types/database.ts` | Supabase CLI 자동 생성 (`supabase gen types typescript`) | 권오인 생성, 이지형 import |
| `src/types/domain.ts` | 공통 도메인 타입 (`BookWithChapters`, `CommentWithReply` 등 join 결과) | 공동 편집 |

### 4-5. 목업 데이터 (권오인 선제 제공)

F-06 완성 전 이지형이 UI 작업 가능하도록 `supabase/seed.sql` 제공 (F-01 PR에 포함):

- 어르신 1명, 가족 3명, `family_links` 수락 완료 상태
- 월간 책 3권 (`draft` 1 + `editing` 1 + `published` 1)
- 챕터 4개 × 각 책, 댓글 2개, 답글 1개
- 표지 후보 3장 (dummy 이미지 URL)
- 알림 5개 (읽음/미읽음 혼합)

---

## 5. 기능 간 의존성 맵

### 5-1. 핵심 선행 조건

```
F-01 백엔드 기반  ─┐
                   ├── 모든 기능의 선행 조건
F-10 프론트 기반  ─┘
```

### 5-2. 권오인 트랙 내부 의존성

```
F-02 인증 ──┬─> F-03 음성 대화 ──┬─> F-04 메모리 추출 ──> F-05 선제 대화·태그
            │  (Whisper+Naver TTS) │                              │
            │                      │                              ├─> F-06 월말 책 (book_type='monthly')
            │                      │                              │       │
            │                      │                              │       └─> F-07 표지 (cover 단계 병렬)
            │                      │                              │       │
            │                      │                              │       └─> F-08 실패 복구
            │                      │                              │
            │                      │                              └─> F-18 외전 책 (book_type='short')
            │                      │                                      │
            │                      │                                      └─> F-07 표지 재사용 + F-12/F-13 공통 플로우
            │                      │
            │                      └─> (발화 데이터 축적 → F-06/F-18 공통 입력)
            │
            └─> (Edge Function 인프라 공유)

F-09 Whisper 파인튜닝 검증 (2~6주차, 포트폴리오용 독립 트랙)
     └─ 결과: 순정 모델 우수 (CER 6% vs 9%) → 실서비스 미연동, F-03은 순정 API 사용
```

### 5-3. 이지형 트랙 내부 의존성

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

### 5-4. 교차 의존성 (권오인 → 이지형 handoff)

| 이지형 기능 | 선행 필요 (권오인) | 해결 방식 |
| --- | --- | --- |
| F-11 가족 초대 | F-02 인증 | F-02 완성 직후 시작 (핵심 병목 ①) |
| F-12 책 편집 | F-06 책 생성 | 목업 데이터(책 1권 + 챕터 3개)로 이지형 선제 작업 (핵심 병목 ②) |
| F-13 표지 선택 | F-07 표지 생성 | 목업 이미지 3장으로 UI 선행 구현 |
| F-14 책장 | F-06 + F-11 | `seed.sql` 목업 책 3권으로 UI 선행 구현 |
| F-17 알림 UI | F-01 notifications 테이블 | F-01 완료 시점에 테이블만 확보되면 진행 가능 |

### 5-5. 핵심 병목 2개

> **① F-02 인증** — 이지형의 F-11이 막힘 → 권오인 초기 최우선 완료 대상
> 
> 
> **② F-06 책 생성** — 이지형의 F-12·F-13·F-14 3개가 막힘 → 목업 데이터 선제 제공으로 블로킹 해소
> 

---

## 6. 협업 규칙

### 6-1. 브랜치 전략

- 각 기능은 `feature/*` 브랜치로 독립 개발
- `feature/*` → `develop` PR → 상대방 리뷰 → 머지 → `develop` → `main`
- 셀프 머지 금지: 반드시 상대방 리뷰 후 머지
- 커밋 컨벤션: `feat: ~`, `fix: ~`, `chore: ~` (한글 타입 가능)

### 6-2. 공통 파일 변경 규칙

`PR에서 상대방 명시 멘션 필수` 대상 파일:

- `src/types/*` 변경 시
- `supabase/migrations/*` 변경 시
- §4 인터페이스(RPC / Realtime 채널 / Storage 경로) 변경 시

### 6-3. Phase 2 향후 고도화 (MVP 이후)

MVP 범위 외이며, 완료 후 담당 재논의 예정:

- 합본 자동 생성 (6개월/1년)
- 인쇄 제본 연동 (양장본·하드커버)
- 가족 하이라이트 / 사진 첨부 기증
- ElevenLabs TTS 고도화
- LLM 파인튜닝 (문제 발생 시 한정)

---

*오브젠 | 2026 | 기능 정의서 v1.0*