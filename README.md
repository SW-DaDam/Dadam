# 다담 (DaDam)

> AI 말동무 기반 시니어용 가족 출판 플랫폼

어르신이 AI와 나눈 대화를 바탕으로 자동으로 책을 만들어, 가족·지인과 함께 읽을 수 있는 서비스입니다.

---

## 주요 기능

- **AI 말동무** — 음성·텍스트로 AI와 대화하며 추억과 이야기를 기록
- **자동 책 생성** — 대화 내용을 AI가 챕터별로 정리해 책으로 출판
- **표지 생성** — AI가 책 내용에 맞는 표지 이미지 자동 생성
- **독자 초대** — 카카오 링크로 가족·지인을 독자로 초대
- **댓글 & 답장** — 독자가 책에 댓글을 달고 저자가 음성으로 답장
- **푸시 알림** — 댓글·출판 알림을 실시간으로 수신

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4 |
| UI | shadcn/ui, Lucide React |
| Backend | Supabase (Postgres, Auth, Realtime, Storage) |
| Edge Functions | Deno (voice-chat, generate-book, generate-cover 등 11개) |
| AI | OpenAI GPT-4o, Clova TTS, Whisper STT |
| 배포 | Vercel (Frontend), Supabase Cloud |

---

## 프로젝트 구조

```
Dadam/
├── frontend/               # React 앱
│   └── src/
│       ├── features/       # 기능별 모듈
│       │   ├── auth/       # 로그인·회원가입
│       │   ├── senior/     # 저자(시니어) 화면
│       │   ├── reader/     # 독자 화면
│       │   ├── chat/       # AI 말동무 대화
│       │   ├── memory/     # AI 기억 관리
│       │   ├── family/     # 독자 초대·연결
│       │   ├── bookshelf/  # 책장·책 편집
│       │   └── notifications/ # 알림
│       ├── shared/         # 공용 컴포넌트·훅·스토어
│       └── lib/            # Supabase 클라이언트 등
├── supabase/
│   ├── functions/          # Edge Functions (11개)
│   ├── migrations/         # DB 마이그레이션
│   └── seed.sql            # 초기 데이터
└── vercel.json             # 배포 설정
```

---

## 로컬 실행

### 1. 의존성 설치

```bash
cd frontend
npm install --legacy-peer-deps
```

### 2. 환경변수 설정

```bash
cp frontend/.env.example frontend/.env.local
```

`.env.local`에 아래 값을 채워주세요:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. 개발 서버 실행

```bash
cd frontend
npm run dev
```

---

## 배포

Vercel에 연결된 저장소의 `main` 브랜치에 push하면 자동 배포됩니다.

```bash
# 빌드 확인
cd frontend && npm run build
```
