# 권오인 — 주차별 상세 로드맵 (AI·음성·백엔드)

> **기간**: 2026.04.10 ~ 2026.06.16 (9주)
> **범례**: 🔴 블로킹 의존성 | 🟡 목업으로 선행 가능 | 🟢 독립 작업 | ✅ 완료 체크박스

---

### 1주차 (04.10 ~ 04.16) — 분석 · 설계 준비

- [ ] PRD v2.x 최종 검토 및 Q7·Q8 결정 준비
- [ ] ERD 초안 작성 (13개 테이블 스키마 설계)
- [ ] AI Hub 데이터셋(107·94·86·543·71703·046) 신청 시작
- [x] Supabase 프로젝트 생성 · 환경변수 세팅
- [ ] 개발 환경 구성 (로컬 Supabase CLI, Deno Edge Function)

> 🔴 **의존성**: 이 주차 ERD 확정이 전체 일정의 기준점

---

### 2주차 (04.17 ~ 04.23) — 백엔드 기반 (F-01) · Whisper 시작

- [ ] **[F-01]** Supabase 마이그레이션 작성
  - [ ] 13개 테이블 생성 (`profiles`, `senior_profiles`, `family_links`, `memories`, `conversations`, `utterances`, `books`, `chapters`, `comments`, `replies`, `cover_images`, `notifications`, `book_generation_jobs`)
  - [ ] RLS 정책 전체 적용
  - [ ] Storage 버킷 3개 생성 (`avatars`, `book-covers`, `reply-audio`)
  - [ ] `pg_cron` 월말 트리거 설정
  - [ ] Realtime publication 설정
  - [ ] `supabase/seed.sql` 목업 데이터 작성 (어르신 1명·가족 3명·책 3권·챕터 12개·댓글·알림)
- [ ] **[F-09]** Whisper 파인튜닝 시작
  - [ ] AI Hub 107·94 데이터셋 다운로드 · 전처리 스크립트 작성
  - [ ] Colab Pro+ 환경 세팅 · LoRA 파인튜닝 1차 시작

> 🔴 **의존성**: F-01 완료 시 이지형에게 `supabase gen types typescript` PR 공유 필수
> 🟡 **병렬**: Whisper 파인튜닝은 독립 트랙, 개발 일정과 무관하게 병행

---

### 3주차 (04.24 ~ 04.30) — 인증 (F-02) · 음성대화 시작 (F-03)

- [ ] **[F-02]** 카카오 OAuth2.0 인증
  - [ ] Supabase Auth 카카오 프로바이더 설정
  - [ ] 로그인/콜백 페이지 (`src/pages/auth/`)
  - [ ] `profiles`, `senior_profiles`, `memories` 자동 생성 트리거
  - [ ] `useAuth.ts` 훅 작성
- [ ] **[F-03]** AI 말동무 음성대화 — 1차 (기본 연결)
  - [ ] `voice-chat` Edge Function 뼈대 (Vercel AI SDK 스트리밍)
  - [ ] Web Speech API STT (`lang='ko-KR'`) 연동
  - [ ] Web Speech API TTS (`rate=0.9`) 연동
  - [ ] `useVoiceChat.ts` 훅 작성
  - [ ] 말동무 화면 기본 UI (`src/pages/chat/`)
- [ ] **[F-09]** AI Hub 데이터셋 86·543·71703·046 다운로드 완료

> 🔴 **의존성**: F-02 완료 후 이지형 F-11(가족 초대) 블로킹 해소됨 → 즉시 알림

---

### 4주차 (04.17 ~ 05.07) — 음성대화 완료 · 메모리 (F-04) · Whisper 학습

- [ ] **[F-03]** AI 말동무 음성대화 — 완료
  - [ ] 음성 실패 시 텍스트 fallback 처리
  - [ ] 대화 중 끊김·오인식 자동 복구 흐름
  - [ ] `conversations` · `utterances` 테이블 저장 연동
- [ ] **[F-04]** 관심사 메모리 추출·누적
  - [ ] `extract-memory` Edge Function (세션 종료 시 LLM 호출)
  - [ ] `memories.data` JSONB 카테고리별 갱신 로직
  - [ ] "내 이야기 메모" 화면 (`src/pages/memory/`)
- [ ] **[F-09]** Whisper LoRA 파인튜닝 학습 진행 (Colab 백그라운드)
  - [ ] 도메인 4개 (자유대화·명령어·노인 음성) 검증셋 CER/WER 측정

> 🟡 **이지형 handoff**: seed.sql 기반 목업 데이터로 F-14 책장 UI 선행 가능

---

### 5주차 (05.08 ~ 05.14) — 선제대화 (F-05) · 책 생성 파이프라인 시작 (F-06)

- [ ] **[F-05]** AI 기억 기반 선제 대화 + 발화 태그 분류
  - [ ] `tag-utterances` Edge Function (`daily_mundane` · `memory_recall` · `emotional_peak` · `philosophy` · `relationship_event`)
  - [ ] 화제 후보 자동 선별 로직 (memories → 프롬프트 주입)
  - [ ] 선제 발화 생성 테스트
- [ ] **[F-06]** 월말 책 초안 자동 생성 파이프라인 — 1차
  - [ ] `generate-book` Edge Function 뼈대
  - [ ] `book_generation_jobs` 3단계 상태 관리 (`aggregating` → `chaptering` → `cover`)
  - [ ] 발화 선별 로직 (태그 가중치·감정 강도 기준 10~20%)
- [ ] **[F-09]** Whisper 파인튜닝 평가 완료 · 결과 정리

> 🔴 **의존성**: F-05는 F-04(메모리) 완료 후 시작
> 🔴 **의존성**: F-06은 F-05(발화 태그) 완료 후 시작

---

### 6주차 (05.15 ~ 05.21) — 책 생성 완료 (F-06) · 표지 생성 (F-07) · Runpod 배포

- [ ] **[F-06]** 월말 책 초안 자동 생성 — 완료
  - [ ] 주제 기반 챕터 구성 LLM 프롬프트 (3~5챕터, 챕터당 최대 4쪽)
  - [ ] 서사 문장화 생성 검증
  - [ ] `pg_cron` 월말 자동 실행 테스트
- [ ] **[F-07]** DALL-E 3 표지 후보 생성
  - [ ] `generate-cover` Edge Function
  - [ ] `book-covers` 버킷 저장 (3~5개 후보)
  - [ ] `cover_images` 테이블 연동
- [ ] **[F-09]** Runpod Serverless GPU 배포
  - [ ] Whisper 모델 Runpod 컨테이너화
  - [ ] Supabase Edge Function → Runpod API 연동 테스트

> 🔴 **의존성**: F-07은 F-06 `chaptering` 단계 완료 후 시작
> 🟡 **이지형 handoff**: F-06·F-07 완료 시 실데이터로 F-12·F-13·F-14 연동 전환

---

### 7주차 (05.22 ~ 05.28) — 실패 복구 (F-08) · Whisper 연동 · 버그픽스

- [ ] **[F-08]** 책 생성 실패 복구
  - [ ] `retry-book-job` Edge Function
  - [ ] `retry_count` 자동 재시도 3회 로직
  - [ ] `retry_book_generation(job_id)` RPC 완성
- [ ] **[F-09]** Whisper → Supabase Edge Function 최종 연동
  - [ ] F-03 STT 부분 Whisper API 교체 (인터페이스 동일 유지)
  - [ ] Web Speech API vs 파인튜닝 Whisper 인식률 비교 기록
- [ ] 전체 권오인 트랙 버그픽스 · 코드 정리
- [ ] RPC 함수 최종 완성 및 이지형에게 문서 공유

> 🟢 **독립**: F-08은 F-06·F-07 완료 후 병렬 진행 가능

---

### 8주차 (05.29 ~ 06.04) — E2E 테스트 · 성능 최적화

- [ ] 어르신-가족 End-to-End 시나리오 테스트
  - [ ] 음성 대화 → 메모리 추출 → 태그 분류 흐름
  - [ ] 책 생성 → 표지 선택 → 출간 → 가족 알림 흐름
- [ ] Web Speech API vs Whisper 인식률 비교 테스트 (시니어 대상)
- [ ] LLM 응답 스트리밍 최적화 · 컨텍스트 길이 관리
- [ ] 표지 이미지 생성 캐싱 적용
- [ ] Supabase RLS 보안 점검

---

### 9주차 (06.05 ~ 06.16) — 최종 점검 · GPT-4o 전환 · 데모

- [ ] `ACTIVE_MODEL` 환경변수 GPT-4o(mini) 전환
- [ ] 프롬프트 전체 재검증 (GPT-4o 기준)
- [ ] 데모용 샘플 책 1권 수동 생성 및 품질 확인
- [ ] 배포 최종 점검 (Vercel + Supabase)
- [ ] 발표 자료용 시연 시나리오 실행 테스트
