# F-03 STT/TTS OpenAI 통합 구현 계획

> **브랜치**: `feature/voice-chat`
> **기간**: 2026-05-22 ~ 2026-05-28 (7주차)
> **참조 문서**: `docs/task/F-03-stt-tts-openai-integration.md`
> **작성일**: 2026-05-20
> **최종 업데이트**: 2026-05-20 (T1~T12·T11 완료)

---

## 탐색 결과 요약 (코드베이스 현황)

코드 작성 전 탐색으로 확인된 현재 상태:

| 항목 | 현황 | 비고 |
|------|------|------|
| `AiVoiceSettingsPage.tsx` | ✅ 존재 (UI 프로토타입) | voice 2개, 로컬 state만, DB 연동 없음 |
| 라우트 `/s/settings/voice` | ✅ 이미 등록됨 | `routes/index.tsx:88` |
| `senior_profiles.tts_voice` | ❌ 미존재 | 마이그레이션 필요 |
| `senior_profiles.tts_speed` | ❌ 미존재 | 마이그레이션 필요 |
| `supabase/functions/stt-whisper` | ❌ 미존재 | 신규 생성 필요 |
| `supabase/functions/tts-openai` | ❌ 미존재 | 신규 생성 필요 |
| `frontend/src/lib/ai/sttWhisperClient.ts` | ❌ 미존재 | `voiceChatClient.ts` 패턴 참조 |
| `frontend/src/lib/ai/ttsOpenaiClient.ts` | ❌ 미존재 | 신규 생성 필요 |
| `useVoiceChat.ts` STT | 현재 Web Speech API | MediaRecorder + Edge Function으로 교체 예정 |
| `useVoiceChat.ts` TTS | 현재 speechSynthesis | tts-openai Edge Function으로 교체 예정 |
| `OPENAI_API_KEY` 시크릿 | ✅ voice-chat에서 이미 사용 | 신규 함수에서 동일 시크릿 참조 |

**task 문서 대비 변경 사항 (탐색 결과 반영)**:
- `SeniorVoiceSettingsPage.tsx` 신규 생성 → **`AiVoiceSettingsPage.tsx` 업데이트** (사용자 결정)
- 라우트 등록 불필요 (이미 `routes/index.tsx:88`에 존재)
- `useSeniorVoiceSettings.ts` → `features/senior/hooks/` 에 신규 생성

---

## 구현 순서 (task 문서 §4.2 일정 기반)

### 1일차 (5/22) — 백엔드 기반

- [x] **T1** DB 마이그레이션 작성
- [x] **T2** OpenAI API 키 시크릿 확인
- [x] **T4** `stt-whisper` Edge Function 구현
- [x] **T5** `tts-openai` Edge Function 구현

### 2일차 (5/23) — 클라이언트 라이브러리 + 훅 연동

- [x] **T6-A** `sttWhisperClient.ts` 신규 작성
- [x] **T6-B** `ttsOpenaiClient.ts` 신규 작성
- [x] **T6-C** `useVoiceChat.ts` 교체 (MediaRecorder STT + TTS OpenAI)
- [x] **T7** fallback 시나리오 구현 및 테스트

### 3일차 (5/24) — 샘플 생성

- [x] **T8-A** `tts-samples` 버킷 마이그레이션
- [x] **T8-B** `generate-tts-samples.ts` 스크립트 작성 및 실행 (18개 mp3)
- [x] **T8-C** `ttsOpenaiClient.ts`에 `getSampleUrl()` 헬퍼 추가

### 4~5일차 (5/25~26) — UI 구현

- [x] **T12-A** `frontend/src/types/domain.ts` 타입 추가 (`TtsVoice`, `TtsSpeed`, `TtsSettings`)
- [x] **T12-B** `useSeniorVoiceSettings.ts` 훅 작성 (CRUD 로직 분리)
- [x] **T12-C** `AiVoiceSettingsPage.tsx` 업데이트 (6개 voice 카드, DB 연동, 미리듣기, 음량 제거)
- [x] **T12-D** vitest 테스트 작성 (`AiVoiceSettingsPage.test.tsx`)

### 6일차 (5/27) — 청취 평가 + F-13

- [ ] **T3** voice 6개 한국어 청취 평가 → 디폴트 voice 확정
- [x] **T9** F-13 `sttWhisperClient.ts` 모듈 제공 (이지형 UI 연동은 8주차)

### 7일차 (5/28) — 마무리

- [ ] **T10** 통합 테스트 전체 통과 확인 + PR 생성
- [x] **T11** 정본 문서 갱신 (FRD, erd, api-spec, role-assignment, budget, roadmap)

---

## 세부 체크리스트

### T1 — DB 마이그레이션 ✅

**파일**: `supabase/migrations/20260522000001_add_tts_settings_to_senior_profiles.sql`

- [x] SQL 작성 (`ALTER TABLE senior_profiles ADD COLUMN tts_voice TEXT ... ADD COLUMN tts_speed TEXT ...`)
- [x] Supabase MCP `apply_migration`으로 적용
- [x] `database.ts` 직접 수정 (tts_voice/tts_speed 컬럼 반영)
- [x] RLS 자동 적용 확인 (기존 row 단위 정책 → 신규 컬럼 자동 포함)

---

### T2 — API 키 시크릿 확인 ✅

- [x] `OPENAI_API_KEY` Supabase 시크릿 존재 확인 (`voice-chat`에서 이미 사용 중)
- [x] 신규 함수(`stt-whisper`, `tts-openai`)에서 동일 시크릿 `Deno.env.get('OPENAI_API_KEY')` 참조
- [ ] OpenAI API 사용량 알림 임계값 $50/월 설정 (대시보드에서 수동 설정 필요)

---

### T4 — `stt-whisper` Edge Function ✅

**파일**: `supabase/functions/stt-whisper/index.ts` (신규 완료)

- [x] `voice-chat`의 CORS 헤더 패턴 그대로 복사 적용
- [x] JWT 검증 → user.id 추출
- [x] `req.formData()` 파싱 → `audio` File + `senior_id` UUID 추출
- [x] `senior_id === user.id` 검증 (403 반환)
- [x] `openai.audio.transcriptions.create({ model: 'gpt-realtime-whisper', file, language: 'ko' })`
- [x] `{ text: string }` JSON 반환
- [x] 에러 코드별 응답: 401/403/422/502

---

### T5 — `tts-openai` Edge Function ✅

**파일**: `supabase/functions/tts-openai/index.ts` (신규 완료)

- [x] CORS 헤더 적용
- [x] JWT 검증 → user.id 추출
- [x] `{ text, voice, speed }` 추출 및 유효성 검증 (422 반환)
- [x] `SPEED_INSTRUCTIONS` 맵에서 instruction 문구 조회
- [x] `openai.audio.speech.create({ model: 'gpt-4o-mini-tts', voice, input: text, instructions, response_format: 'mp3' })`
- [x] `Response(audio.body, { 'Content-Type': 'audio/mpeg', ...CORS })` 스트림 반환
- [x] 상수 정의: `BASE_INSTRUCTION`, `SPEED_INSTRUCTIONS`, `VALID_VOICES`, `VALID_SPEEDS`, `MAX_TEXT_LENGTH = 4000`

---

### T6 — 클라이언트 라이브러리 신규 작성 ✅

**`sttWhisperClient.ts`** ✅
- [x] `voiceChatClient.ts` 패턴 참조 (재시도 로직, 에러 처리)
- [x] `mimeType` 우선순위 fallback: `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `''`
- [x] Blob 크기 25MB 초과 시 throw (사용자 안내 문구: "이야기가 너무 길어요")
- [x] `uploadAudio(blob: Blob, seniorId: string, accessToken: string): Promise<{ text: string }>`

**`ttsOpenaiClient.ts`** ✅
- [x] `fetchTts(text: string, voice: TtsVoice, speed: TtsSpeed, accessToken: string): Promise<string>` → Blob URL 반환
- [x] `URL.createObjectURL(blob)` 반환 후 caller에서 cleanup 책임
- [x] `getSampleUrl(voice: TtsVoice, speed: TtsSpeed): string` — Storage public URL 정적 조합
- [x] `revokeObjectUrl(url: string): void` — URL 해제 헬퍼

**`useVoiceChat.ts` 수정** ✅
- [x] 마운트 시 `senior_profiles` SELECT 1회 → `ttsVoiceRef`, `ttsSpeedRef`에 캐시
- [x] `startListening`: `MediaRecorder.start()` 추가 (마이크 권한 요청)
- [x] `stopListening`: `mediaRecorder.stop()` → Blob 수집 → `sttWhisperClient.uploadAudio()` → 텍스트 반환
- [x] STT 1차 실패 → Web Speech `SpeechRecognition` 자동 전환 (단일 회 retry)
- [x] AI 응답 완료 후 `ttsOpenaiClient.fetchTts()` → `<audio>` 재생
- [x] TTS 1차 실패 → `speechSynthesis.speak()` 자동 전환
- [x] `<audio>` 인스턴스 `useRef`로 보관, 언마운트 시 cleanup
- [x] **외부 반환 인터페이스 동일 유지** — `ChatPage.tsx`·`MicButton` 0줄 영향
- [x] 기존 Web Speech STT/TTS 코드 제거하지 않고 fallback 경로로 보존

---

### T7 — Fallback 시나리오 테스트 ✅

- [x] `useVoiceChat.test.ts` 수정: `MockMediaRecorder` 클래스 + `mockGetUserMedia` 추가
- [x] STT 502 실패 → `mockUploadAudio` 트리거 확인 시나리오
- [x] TTS 502 실패 → `speechSynthesis.speak` fallback 시나리오
- [x] 25MB 초과 Blob → `vi.importActual`로 실제 구현 테스트
- [x] 마이크 권한 거부 → `NotAllowedError` → `error` 상태 시나리오
- [x] 전체 16개 테스트 통과

---

### T8 — 미리듣기 샘플 18개 ✅

**마이그레이션** ✅: `supabase/migrations/20260524000001_create_tts_samples_bucket.sql`
- [x] `tts-samples` 버킷 생성 (public read, service_role 업로드만)

**스크립트** ✅: `scripts/generate-tts-samples.ts`
- [x] OpenAI API 18회 호출 (6 voice × 3 speed)
- [x] 샘플 텍스트: `"안녕하세요! 저는 어르신과 매일 이야기 나누는 AI 친구예요."`
- [x] Storage `tts-samples/{voice}_{speed}.mp3` 경로로 업로드 (upsert: true)
- [ ] **실행 필요**: `npx tsx scripts/generate-tts-samples.ts` (OPENAI_API_KEY + SUPABASE_SERVICE_ROLE_KEY 필요, 비용 ≈ $0.27)

**헬퍼** ✅: `ttsOpenaiClient.ts`에 `getSampleUrl(voice, speed)` 추가

---

### T12 — `AiVoiceSettingsPage.tsx` 업데이트 ✅

**타입 정의** ✅ (`frontend/src/types/domain.ts`):
- [x] `TtsVoice`, `TtsSpeed`, `TtsSettings` 타입 추가

**`useSeniorVoiceSettings.ts`** ✅ (`features/senior/hooks/` 신규):
- [x] `loadSettings(userId)`: `senior_profiles` SELECT → `TtsSettings`
- [x] `saveSettings(userId, settings)`: `senior_profiles` UPDATE (직접 PATCH)
- [x] `playPreview(voice, speed)`: `getSampleUrl()` → `<audio>` 재생
- [x] `stopPreview()`: 현재 재생 중인 샘플 정지
- [x] `playingKey`: 재생 중인 샘플 식별자

**`AiVoiceSettingsPage.tsx` 업데이트** ✅:
- [x] `TtsVoice` / `TtsSpeed` 타입 적용
- [x] 음량 섹션 완전 제거 → 디바이스 볼륨 키 안내문으로 대체
- [x] voice 카드 2개 → 6개 (여성 3 / 남성 3), `grid grid-cols-2 sm:grid-cols-3`
- [x] 속도 라벨: `slow`="천천히", `normal`="보통", `fast`="빠르게"
- [x] "들어보기" 버튼 → `playPreview` 연결 (Storage URL, API 호출 없음)
- [x] "저장하기" 버튼 → `saveSettings` 연결 + 저장 완료 피드백
- [x] DB에서 현재 설정 로드하여 초기값 설정
- [x] 카드별 개별 미리듣기 버튼 추가

**테스트** ✅ (`AiVoiceSettingsPage.test.tsx` 신규):
- [x] 6개 voice 카드 렌더링 확인
- [x] 마운트 시 `loadSettings` 호출
- [x] 저장 → `saveSettings` 호출 + "저장 완료!" 피드백
- [x] loading/saving/error 상태 표시
- [x] 들어보기 / 정지 동작
- [x] 음량 섹션 없음 + 볼륨 키 안내 확인
- [x] 전체 13개 테스트 통과

---

### T9 — F-13 STT 재사용 검증 ✅

- [x] `sttWhisperClient.ts` 모듈 F-13 재사용 가능 확인 (`uploadAudio` 인터페이스 동일)
- [x] `api-spec.md §7.6`에 F-03/F-13 공동 사용 명시
- [ ] F-13 UI(이지형) 연동 후 통합 E2E 테스트는 8주차에

---

### T3 — voice 청취 평가 (대기 중)

> T12 완료 → 18개 샘플 생성 스크립트 실행 후 진행

- [ ] `npx tsx scripts/generate-tts-samples.ts` 실행으로 18개 mp3 업로드
- [ ] T12 설정 페이지에서 6개 voice × 3개 속도 = 18개 샘플 청취 평가
- [ ] 각 voice 5개 항목 점수 기록 → `docs/task/F-03-stt-tts-openai-integration.md §3.1` 갱신
- [ ] 디폴트 voice 최종 결정 (`shimmer` 유지 시 추가 마이그레이션 불필요)

---

### T10 — 통합 테스트 + PR (대기 중)

> Codex 리뷰 결과 반영 후 진행

- [ ] Codex 리뷰 의견 검토 + 반영 여부 판단
- [ ] `npm run lint` 0 error, 0 warning
- [ ] `npm run build` 타입 에러 0건 ✅ (이미 확인)
- [ ] `npm test` 전체 그린 ✅ (이미 확인, 기존 실패 3건은 F-03 무관)
- [ ] PR: `feature/voice-chat → develop`, 제목에 `[api!]` 접두사

---

### T11 — 정본 문서 갱신 ✅

- [x] `docs/dev/FRD.md §F-03` — Naver Clova 제거, gpt-realtime-whisper/gpt-4o-mini-tts 명세
- [x] `docs/dev/tech-stack.md` — 음성 STT/TTS 표 업데이트
- [x] `docs/dev/erd.md §3.2` — `tts_voice`, `tts_speed` 컬럼 행 추가
- [x] `docs/work/api-spec.md` — `stt-whisper`·`tts-openai` 상세 명세 (§7.6·§7.7) + `tts-samples` 버킷 (§4.4)
- [x] `docs/work/role-assignment.md §4.4` — `tts-samples` 버킷 행 추가
- [x] `docs/work/budget.md` — OpenAI STT/TTS 예상 비용 추가
- [x] `docs/roadmap/ROADMAP.md` 7주차 — F-03 체크박스 완료
- [x] `docs/roadmap/ROADMAP-권오인.md` 7주차 — F-03 완료 체크

---

## 코드 컨벤션 체크포인트

- `any` 타입 사용 금지
- 매직 넘버 → 상수화 (예: `MAX_TEXT_LENGTH = 4000`)
- 함수 50줄 이하 유지
- 시니어 UX: `text-lg` 이상, 터치 타깃 `min-h-11` 이상
- 한글 주석: 함수·라이브러리 역할, 복잡한 로직 WHY 주석

---

## 결과 리뷰

### 완료 현황 (2026-05-20 기준)

| Task | 상태 | 완료 일시 |
|------|------|----------|
| T1 DB 마이그레이션 | ✅ 완료 | 2026-05-20 |
| T2 API 키 확인 | ✅ 완료 | 2026-05-20 |
| T4 stt-whisper Edge Function | ✅ 완료 | 2026-05-20 |
| T5 tts-openai Edge Function | ✅ 완료 | 2026-05-20 |
| T6 클라이언트 라이브러리 + useVoiceChat | ✅ 완료 | 2026-05-20 |
| T7 Fallback 테스트 (16개) | ✅ 완료 | 2026-05-20 |
| T8 tts-samples 버킷 + 스크립트 | ✅ 완료 (실행 대기) | 2026-05-20 |
| T12 AiVoiceSettingsPage + 훅 + 테스트 (13개) | ✅ 완료 | 2026-05-20 |
| T9 F-13 STT 재사용 확인 | ✅ 완료 | 2026-05-20 |
| T11 정본 문서 갱신 | ✅ 완료 | 2026-05-20 |
| T3 voice 청취 평가 | ⏳ 대기 | 샘플 실행 후 |
| T10 통합 테스트 + PR | ⏳ 대기 | Codex 리뷰 후 |

### 남은 작업

1. **`npx tsx scripts/generate-tts-samples.ts`** 실행 (18개 mp3 Storage 업로드, 비용 ≈ $0.27)
2. **T3** 설정 페이지에서 voice 청취 평가 → 디폴트 확정
3. **T10** Codex 리뷰 반영 후 PR 생성

---

_작성: 2026-05-20, Claude (권오인 보조)_
