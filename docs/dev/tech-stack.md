# 기술 스택 및 의존성

> 팀원 개발 환경 세팅 시 참고하세요.
> 본 문서는 PRD v2.0(시니어 가족 출판 플랫폼) 기준입니다.

## 실행 환경

| 항목 | 버전 |
|------|------|
| Node.js | v24.13.1 |
| npm | v11.8.0 |

---

## 기술 스택 개요

| 영역 | 기술 |
|------|------|
| **Frontend** | React 19, Vite 8, TypeScript, React Router v7 |
| **PWA** | Vite PWA Plugin (설치형 웹앱) |
| **스타일링** | Tailwind CSS v4, shadcn/ui v4 |
| **상태 관리** | Zustand (전역 상태), TanStack Query v5 (서버 상태) |
| **Backend** | Supabase (Auth + DB + Realtime + Storage + Edge Functions) |
| **AI 프록시** | Supabase Edge Functions (Vercel AI SDK를 통한 LLM 호출) |
| **AI SDK** | Vercel AI SDK (모델 추상화 레이어 — Gemini / GPT / Claude 통합 인터페이스) |
| **AI LLM** | GPT-4o / GPT-4o-mini (상용화), Gemini 1.5 Flash (개발·테스트) |
| **음성 STT** | **OpenAI `gpt-realtime-whisper`** — `stt-whisper` Edge Function, MediaRecorder Blob → REST batch, Web Speech API fallback |
| **음성 TTS** | **Naver Clova Voice Premium** — `tts-clova` Edge Function, Phase 1 voice 1종 `ngoeun`(고은) + 속도 3단계, JWT ES256 JWKS 검증 + AbortController 타임아웃 + MP3 패스스루로 응답 지연 최소화, Web Speech API SpeechSynthesis fallback. Phase 2에서 voice 6종으로 확장 예정 |
| **LLM 품질 개선 전략** | 프롬프트 엔지니어링 + 관심사 메모리 RAG 우선 / 문제 발생 시 파인튜닝 검토 |
| **이미지 생성** | DALL-E 3 (책 표지 후보 이미지) |
| **실시간** | Supabase Realtime (신간 알림 + 댓글 알림) |
| **배치 작업** | Supabase Scheduled Edge Functions / pg_cron (월말 책 초안 생성) |
| **배포** | Vercel (프론트엔드), Supabase (백엔드) |
| **소셜 로그인** | 카카오 OAuth2.0 |

---

## 프론트엔드 (`frontend/`)

### 핵심 프레임워크

| 패키지 | 버전 | 설명 |
|--------|------|------|
| react | ^19.2.4 | UI 라이브러리 |
| react-dom | ^19.2.4 | React DOM 렌더러 |
| vite | ^8.0.4 | 번들러 / 개발 서버 |
| typescript | - | 타입 안전성 |
| react-router-dom | ^7.x | 클라이언트 라우팅 |
| vite-plugin-pwa | ^0.x | PWA (설치형 웹앱) 지원 |

### 상태 관리

| 패키지 | 버전 | 설명 |
|--------|------|------|
| zustand | ^5.x | 전역 상태 관리 (인증, 음성 세션 상태 등) |
| @tanstack/react-query | ^5.x | 서버 상태 관리 (AI 응답 캐싱, 로딩/에러 처리) |

### UI / 스타일링

| 패키지 | 버전 | 설명 |
|--------|------|------|
| tailwindcss | ^4.2.2 | 유틸리티 CSS 프레임워크 |
| @tailwindcss/vite | ^4.2.2 | Vite용 Tailwind 플러그인 |
| shadcn | ^4.2.0 | shadcn/ui 컴포넌트 CLI |
| tw-animate-css | ^1.4.0 | Tailwind 애니메이션 유틸리티 (책장 넘김 등) |
| lucide-react | ^1.8.0 | 아이콘 라이브러리 |
| @fontsource-variable/geist | ^5.2.8 | Geist 가변 폰트 |
| @base-ui/react | ^1.3.0 | 비스타일 UI 프리미티브 |

> 시니어 친화 UI(큰 글씨·고대비·아날로그 책장 메타포)는 Tailwind 커스텀 테마로 구현.

### 음성 (MVP)

| API | 설명 |
|-----|------|
| **Web Speech API — SpeechRecognition** | 어르신 발화 → 텍스트 (STT). `lang='ko-KR'` |
| **Web Speech API — SpeechSynthesis** | AI 응답 텍스트 → 음성 (TTS). `rate=0.9` (시니어 친화) |

> 브라우저 내장 API이므로 별도 의존성 없음.
> Chrome/Edge에서 동작하며, 미지원 브라우저에서는 텍스트 입력으로 fallback.

### 유틸리티

| 패키지 | 버전 | 설명 |
|--------|------|------|
| clsx | ^2.1.1 | 조건부 클래스명 병합 |
| class-variance-authority | ^0.7.1 | 컴포넌트 variant 관리 (cva) |
| tailwind-merge | ^3.5.0 | Tailwind 클래스 충돌 해결 |

### 개발 도구 (devDependencies)

| 패키지 | 버전 | 설명 |
|--------|------|------|
| @vitejs/plugin-react | ^6.0.1 | Vite React 플러그인 (Fast Refresh) |
| eslint | ^9.39.4 | 코드 린터 |
| eslint-plugin-react-hooks | ^7.0.1 | React Hooks 린트 규칙 |
| eslint-plugin-react-refresh | ^0.5.2 | React Refresh 린트 규칙 |
| @eslint/js | ^9.39.4 | ESLint JS 규칙 |
| globals | ^17.4.0 | 전역 변수 목록 |
| @types/react | ^19.2.14 | React 타입 정의 |
| @types/react-dom | ^19.2.3 | React DOM 타입 정의 |
| @types/node | ^25.5.2 | Node.js 타입 정의 |

---

## 백엔드 — Supabase

Spring Boot 대신 Supabase를 채택. 2인 9주 개발 일정에서 인프라 구축 비용 최소화,
AI 기능·시니어 UX에 집중하기 위한 선택.

| 기능 | Supabase 서비스 | 설명 |
|------|----------------|------|
| 인증 | Supabase Auth | 카카오 OAuth2.0 연동 |
| 데이터베이스 | Supabase DB (PostgreSQL) | 어르신 프로필, 관심사 메모리, 대화 기록, 책, 챕터, 댓글 |
| 실시간 | Supabase Realtime | 신간 출간 알림, 댓글 알림 |
| 파일 저장 | Supabase Storage | 책 표지 이미지, 향후 가족 사진(Phase 2) |
| AI 프록시 | Supabase Edge Functions | Vercel AI SDK를 통한 LLM 호출, API 키 은닉, 프롬프트 처리 |
| 배치 작업 | Scheduled Edge Functions / pg_cron | 월말 책 초안 자동 생성, 메모리 갱신 배치 |
| Row Level Security | RLS 정책 | **어르신 대화 원문은 본인만 접근**, 책은 가족 공개 |

### 실시간 알림 구현 방식

Supabase Realtime을 활용해 두 가지 알림을 구현:

- **신간 출간 알림**: 어르신이 월간 책을 출간(승인)하면 `books` 테이블 INSERT 이벤트를 가족 클라이언트가 구독
- **댓글 알림**: 가족이 챕터에 댓글을 남기면 `comments` 테이블 INSERT 이벤트를 어르신·다른 가족이 구독

> 여행 플래닝 시절의 "공동 플래닝 보드(Broadcast + Presence)"는 본 프로젝트에서 사용하지 않음.
> 책·댓글은 비동기 흐름이므로 Postgres Changes 구독만으로 충분.

### 인증 (카카오 OAuth2.0)

- Supabase Auth의 카카오 Provider 사용
- 어르신은 가족이 대신 계정을 생성·연결해주는 것을 기본 가정
- 가족 초대는 초대 링크/코드 기반 (어르신 1명 : 가족 N명)

---

## AI 구성

| 항목 | 내용 |
|------|------|
| **메인 엔진 (상용화)** | GPT-4o / GPT-4o-mini — 높은 안정성과 정교한 서사 품질 |
| **메인 엔진 (개발·테스트)** | Gemini 1.5 Flash — 빠른 응답 속도와 우수한 가성비 |
| **모델 추상화 SDK** | Vercel AI SDK — Gemini / GPT / Claude를 단일 인터페이스로 통합 |
| **모델 교체 방식** | 환경변수 `ACTIVE_MODEL`을 통한 런타임 모델 교체 |
| **호출 구조** | Supabase Edge Functions 내에서 Vercel AI SDK를 통해 LLM 호출 (API 키 클라이언트 노출 방지) |
| **이미지 생성** | DALL-E 3 — 월간 책 표지 3~5개 후보 생성 (Storage에 캐싱) |

### 모델 운영 전략

```
개발·테스트 단계          상용화 단계
┌──────────────────┐     ┌──────────────────────┐
│  Gemini 1.5 Flash │ →→  │  GPT-4o / GPT-4o-mini │
│  (빠른 속도,      │     │  (높은 정확도,         │
│   저비용)         │     │   안정적 품질)          │
└──────────────────┘     └──────────────────────┘
         ↕ 환경변수 ACTIVE_MODEL 전환
┌─────────────────────────────────────────────────┐
│             Vercel AI SDK (모델 추상화 레이어)    │
│         Supabase Edge Functions 내부에서 호출    │
└─────────────────────────────────────────────────┘
```

### AI 파이프라인 역할

| 파이프라인 | 호출 위치 | 설명 |
|-----------|-----------|------|
| 실시간 대화 응답 | Edge Function (스트리밍) | 어르신 발화 → 관심사 메모리 주입 → LLM 응답 → TTS |
| 관심사 메모리 추출 | Edge Function (세션 종료 시) | 대화 로그에서 취미·관계·철학 등 카테고리별 프로파일 갱신 |
| 발화 태그 분류 | Edge Function | `daily_mundane` / `memory_recall` / `emotional_peak` / `philosophy` / `relationship_event` |
| 월말 책 초안 생성 | Scheduled Edge Function (배치) | 태그·빈도·감정 가중치로 10~20% 선별 → 주제 챕터 → 서사 생성 |
| 표지 이미지 생성 | Edge Function (출간 직전) | DALL-E 3로 3~5개 후보 생성 → Storage 저장 |

> 추후 Claude, Llama 등 타 모델로의 교체도 Vercel AI SDK 어댑터 교체만으로 가능.

---

## 배포

| 서비스 | 용도 | 비고 |
|--------|------|------|
| **Vercel** | 프론트엔드 자동 배포 | git push → 자동 배포, HTTPS 자동, PR Preview 지원 |
| **Supabase** | 백엔드 (DB + Auth + Realtime + Edge Functions) | 관리형 서비스, 인프라 관리 불필요 |

> Vercel과 Supabase 모두 내부적으로 AWS 인프라를 사용하며,
> 2인 팀의 인프라 운영 부담 제거 및 개발 속도 확보를 위한 결정.

---

## Whisper 파인튜닝 검증 (F-09, 포트폴리오용)

시니어 음성 인식률은 본 서비스의 핵심 품질 지표. Web Speech API는 표준 발음 기준으로
학습되어 **시니어의 느린 말투·틀니 발음·사투리에서 인식률이 크게 떨어지는 문제**가 있어,
초기 계획은 Whisper 파인튜닝으로 해결하려 함. F-09 트랙에서 turbo-LoRA 파인튜닝 후
3-way CER 비교를 수행한 결과 **순정 turbo가 LoRA·OpenAI API를 모두 능가**(아래 표) —
실서비스 STT는 OpenAI `whisper-1` 클라우드 채택(시연 단계 인프라 0 우선).

### 3-way CER 비교 결과 (2026-05-21, validation 500 샘플)

| 모델 | CER | baseline 대비 | 운영 채택 |
|------|-----|--------------|-----------|
| **baseline (turbo 순정)** | **6.44%** | — | 후속 운영 단계 후보 (자체 GPU/HF Inference API 호스팅) |
| whisper-1 (OpenAI API) | 9.60% | +3.16%p | ✅ **F-03 시연 STT 채택** (인프라 0, 충분 정확도) |
| final2 (LoRA 파인튜닝) | 9.72% | +3.28%p | 사용 안 함 (negative result) |

평가 노트북: `whisper/compare_with_whisper1.ipynb`. 자세한 분석은 FRD §F-09.

### 운영 계획 (갱신)

| 단계 | 시점 | 내용 |
|------|------|------|
| MVP 초반 | 1~5주차 | Web Speech API로 기능 구현 (파인튜닝 병행) |
| MVP 후반 | 6~7주차 | F-09 파인튜닝 검증 → OpenAI `whisper-1`로 F-03 STT 교체 |
| 운영 (졸업 후) | — | turbo 순정 자체 호스팅 검토 (HF Inference Endpoints 등 후속 task) |

> LLM(GPT-4o / Gemini)은 **파인튜닝하지 않음**.
> 어르신 개성 반영은 관심사 메모리 RAG + 프롬프트 엔지니어링으로 1차 해결.
> 실사용에서 LLM이 딴 소리·환각을 반복하는 경우에 한해 파인튜닝 재검토.

### 기술 스택

| 항목 | 선택 | 비고 |
|------|------|------|
| 베이스 모델 | `openai/whisper-small` 또는 `whisper-medium` | 한국어 성능·학습 비용 균형 |
| 학습 라이브러리 | Hugging Face `transformers` + `datasets` + `peft` (LoRA) | LoRA로 VRAM·학습 시간 절감 |
| 학습 프레임워크 | PyTorch | Whisper 공식 지원 |
| 데이터셋 (주) | **AI Hub 자유대화 음성(노인남녀)** — dataSetSn=107 | 60세↑ 1,000명, 3,000h, 사투리·머뭇거림 포함, WAV+전사 |
| 데이터셋 (보조) | **AI Hub 노인 명령어 음성** — dataSetSn=94 | 명령형 발화 패턴 보강 (AI비서·비정형 도메인만 선별) |
| 평가 test set | **107번 AI챗봇 원천 Validation** (key: 48681, 7.14GB) | train과 수집 시점·화자 분리로 독립성 확보 |
| LLM 프롬프트 참고 | **AI Hub 감성대화 말뭉치** — dataSetSn=86 | 감정 라벨링 대화 텍스트, ~20MB |
| LLM 프롬프트 참고 | **AI Hub 주제별 일상대화** — dataSetSn=543 | 카카오·밴드 등 5개 플랫폼, ~200MB |
| 평가 지표 | **CER** (Character Error Rate, 한국어는 음절 단위가 적합) + WER 병기 |
| 모델 서빙 | Hugging Face Inference Endpoint **또는** Runpod 서버리스 GPU | Supabase Edge Function에서 HTTPS 호출 |

> 데이터셋 상세 목록 및 선별 다운로드 목록은 [`docs/datasets.md`](./datasets.md) 참고.

### 데이터 파이프라인

```
107 AI챗봇 원천 1+2 (57GB) + 음성수집도구 원천 1 (29GB)   ← train 메인
94  AI비서 원천 1+8 (20GB) + 비정형 원천 10+11 (4.5GB)    ← train 보조
        ↓ 전처리 (16kHz 리샘플링, 정규화, 침묵 구간 정리)
        ↓ 전사 JSON → Whisper 포맷 변환
        ↓ 서브샘플링 (1차: 100~200h, CER 부족 시 증량)
Hugging Face Datasets 포맷 (train / valid)
        ↓ LoRA 파인튜닝 (Colab Pro+, 백그라운드 실행)
파인튜닝 체크포인트 (어댑터, 수 MB)
        ↓ 평가 (test set = 107 AI챗봇 원천 Validation, key:48681)
        ↓ CER / WER 측정 → 베이스라인 whisper-small 대비 비교
Hugging Face Hub (Private repo) 업로드
        ↓ Runpod Serverless 배포
Supabase Edge Function → HTTPS 프록시 → STT 결과 반환
```

> **서브샘플링 전략**: 전체 137GB를 한 번에 학습하면 Colab Pro+ 컴퓨팅 단위 소진.
> 1차 100~200h → CER 측정 → 부족하면 데이터 추가 투입하는 단계적 접근.

### 인프라 — 저비용 설계 (월 예산 20만원 = $133 기준)

**핵심 전략**: 학습은 **Colab Pro+** (백그라운드 실행 필수) + Runpod Spot 최소 사용, 서빙은 **Runpod Serverless** 로 Cold start 용인하며 유휴 과금 0원.

#### Colab 요금제: Pro+ ($49.99/월) 필수

| 요금제 | 월 비용 | 컴퓨팅 단위 | 백그라운드 실행 | 결론 |
|--------|---------|------------|--------------|------|
| Pro | $9.99 | 100단위 (~8h A100) | ❌ 브라우저 닫으면 중단 | ❌ 파인튜닝 도중 중단 위험 |
| **Pro+** | **$49.99** | **600단위 (~50h A100)** | **✅ 24시간 유지** | **✅ 채택** |

> Whisper LoRA 파인튜닝은 10~20시간 소요. Pro는 브라우저를 닫으면 세션 종료 → 처음부터 재시작.
> Pro+는 밤에 돌려놓고 자도 계속 실행. 컴퓨팅 단위도 600단위로 재학습 2~3회 여유 있음.

> 월별 예산 배분, 비용 최소화 체크리스트, 예비책은 [`docs/budget.md`](./budget.md) 참고.

#### 서빙 전략 (Cold start 용인)

- **Runpod Serverless GPU**: 요청이 있을 때만 실행 → 유휴 시 과금 0
- Cold start 5~15초 발생 → 어르신에게 **"잠시만요, 듣고 있어요"** 시각/음성 피드백 필수
- 웜 상태 유지를 위한 Keep-alive는 비용 증가 유발하므로 MVP에서는 미사용
- **대안**: 시연 시점에만 수동으로 pod 가동 → 시연 직전 1회 warm-up 호출

#### 서빙 아키텍처

```
[어르신 브라우저]
    ↓ MediaRecorder로 음성 녹음 (Blob)
[Supabase Edge Function]
    ↓ Runpod Serverless GPU 엔드포인트로 HTTPS 프록시 (API 키 은닉)
[Runpod Serverless]
    ↓ Whisper 파인튜닝 모델 (HF Hub에서 로드) 추론
    ↓ 전사 텍스트 반환
[Supabase Edge Function]
    ↓ LLM 호출 + 관심사 메모리 주입
[브라우저]
    ↓ TTS로 응답 재생
```

### 라이선스 확인 필요 사항

- **AI Hub 데이터셋**: 학술·연구 목적 라이선스와 상업적 이용 조건이 데이터셋별로 다름. 다운로드 전 약관 확인 필수
- **Whisper 본체**: MIT 라이선스 (상업 이용 자유)

---

## Phase 2 (향후 고도화) 예정 기술

현재 MVP에는 포함되지 않으나, PRD §4.5 / §10.3에서 예정된 항목:

| 영역 | 기술 | 비고 |
|------|------|------|
| TTS 고도화 | **ElevenLabs** | 자연스러운 한국어 TTS, 화자 개성화 가능 |
| 인쇄 제본 | 외부 인쇄 API 연동 | 하드커버 양장본, 배송 관리 |
| 합본 생성 | 자체 배치 로직 | 6개월/1년 단위 월간 책 재편성 |
| LLM 파인튜닝 | GPT / Gemini / 오픈소스 LLM 파인튜닝 | **실사용에서 LLM 품질 문제 발생 시에만 검토** |

---

## 시작하기

```bash
# 의존성 설치
cd frontend
npm install

# 개발 서버 실행 (http://localhost:5173)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 결과 미리보기
npm run preview
```
