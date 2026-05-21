# Design Handoff: 시니어 자서전 앱 (Senior Life Story App)

## Overview

어르신이 AI 말동무와 매일 대화하고, 그 대화가 월간 자서전 책으로 자동 완성되어 가족과 공유되는 모바일 앱입니다.

**핵심 사용자:**
- **저자(어르신):** AI와 음성 대화 → 월간 책 생성 → 가족에게 공유
- **독자(가족):** 어르신의 책장 열람 → 댓글/사진/하이라이트 추가

---

## About the Design Files

이 패키지에 포함된 설계 문서는 **디자인 레퍼런스**입니다. Figma에서 추출한 화면 명세이며, 실제 프로덕션 코드로 그대로 사용하는 것이 아니라 **타깃 코드베이스(React Native, Flutter, Swift 등)의 기존 패턴과 라이브러리를 사용하여 이 디자인을 재현**하는 것이 목표입니다.

## Fidelity

**High-fidelity**: 픽셀 단위 레이아웃, 최종 색상, 타이포그래피, 간격, 인터랙션 플로우가 명시되어 있습니다. 개발자는 이 명세를 기반으로 기존 디자인 시스템에 맞춰 UI를 구현해야 합니다.

---

## Design Tokens

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#E8820C` / `rgb(232,130,12)` | 주 CTA 버튼, AI 아바타, 강조 텍스트, 활성 탭 |
| `primary-light` | `#FFF0DC` / `rgb(255,240,220)` | AI 채팅 버블 배경, 카드 배경 |
| `primary-lighter` | `#FFF8F0` / `rgb(255,248,240)` | 앱 전체 배경색 |
| `success` | `#16A34A` / `rgb(22,163,74)` | 완료된 스텝 인디케이터, 3월 책 색상 |
| `success-light` | `#DCFCE7` / `rgb(220,252,231)` | 성공 알림 카드 배경 |
| `text-primary` | `#1F2937` / `rgb(31,41,55)` | 제목, 주요 본문 |
| `text-secondary` | `#6B7280` / `rgb(107,114,128)` | 부제목, 날짜, 설명 텍스트 |
| `text-disabled` | `#9CA3AF` / `rgb(156,163,175)` | 비활성 탭, 비활성 스텝 |
| `border` | `#E5E7EB` / `rgb(229,231,235)` | 카드 테두리, 구분선 |
| `surface` | `#FFFFFF` | 카드, 모달, 헤더 배경 |
| `background` | `#F3F4F6` / `rgb(243,244,246)` | 비활성 아바타, 회색 배경 |
| `danger` | `#DC2626` / `rgb(220,38,38)` | 삭제 버튼 텍스트 |
| `danger-light` | `#FEF2F2` / `rgb(254,242,242)` | 삭제 버튼 배경 |
| `kakao-yellow` | `#FEF9C3` / `rgb(254,249,195)` | 카카오 관련 버튼 |

### Typography

**Font Family:** `Inter` (전체 앱 단일 폰트)

| Style | Size | Weight | Color | Usage |
|-------|------|--------|-------|-------|
| Title Large | 24px | 700 | `text-primary` | 화면 섹션 제목 |
| Title Medium | 22px | 700 | `text-primary` | 헤더 제목 |
| Body Large | 20px | 400 | `text-primary` | 중요 본문 |
| Body Medium | 18px | 400 | `text-primary` | 일반 본문, 채팅 메시지 |
| Body Small | 16px | 400 | `text-secondary` | 설명 텍스트 |
| Caption | 14px | 400 | `text-secondary` | 날짜, 부가 정보 |
| Label | 13px | 400/700 | varies | 탭 레이블, 배지 |

> ⚠️ **접근성 주의:** 대상 사용자가 어르신이므로 최소 폰트 크기 16px 이상 유지 필수. 터치 타깃 최소 44×44px.

### Spacing & Layout

| Token | Value |
|-------|-------|
| Screen padding (horizontal) | 24px |
| Card padding | 24–32px |
| Card border-radius | 12–16px |
| Header height | 80px |
| Tab bar height | 72px |
| Primary button height | 64–72px |
| Secondary button height | 40–44px |
| Section gap | 16–24px |

---

## Screens / Views

### 1. 로그인 화면 (`login_kakao_screen`)
- **목적:** 카카오 계정으로 소셜 로그인
- **레이아웃:** 중앙 정렬, 로고 + 카카오 로그인 버튼
- **주요 컴포넌트:**
  - 카카오 로그인 버튼: `#FEF9C3` 배경, 800px 너비, 64px 높이, 12px radius

---

### 2. 역할 선택 화면 (`role_select_screen`)
- **목적:** 저자(어르신) 또는 독자(가족) 역할 선택
- **레이아웃:** 두 개의 카드형 선택지 (세로 배열)
- **동작:** 선택 후 해당 역할의 온보딩으로 이동

---

### 3. AI 소개 온보딩 (`senior_onboarding_ai_intro`)
- **목적:** AI 말동무 기능 소개 (저자 온보딩 마지막 화면)
- **레이아웃:** 800×1317px

**구성 요소:**
- **dot-indicator:** 상단 중앙, 온보딩 페이지 진행도 (4개 점)
  - 위치: top 59px, 크기 72×12px
- **AI 아바타:** 중앙 대형 원형, `#E8820C` 배경, "AI" 흰색 텍스트 (28px bold)
- **title-text:** top 318px
  - "안녕하세요!" — 28px bold, `text-primary`
  - "저는 매일 이야기를 나눌 AI 친구예요" — 20px, `text-primary`
- **feature-cards:** top 424px, 3개 기능 카드 (각 98px 높이, 114px 간격)
  - 카드 1: "말로만 해도 돼요" / "글쓰기 없이 말씀하시면 돼요"
  - 카드 2: "이야기가 책이 돼요" / "매달 내 이야기로 책이 만들어져요"
  - 카드 3: "가족과 함께 읽어요" / "자녀·손주가 댓글로 함께해요"
  - 각 카드: 아이콘 영역(좌) + 제목(20px bold) + 설명(18px, `text-secondary`)
- **btn-start:** "대화 시작하기" — `#E8820C` 배경, 752×65px, 24px 흰색 텍스트
- **bottom-note:** 개인정보 보호 안내 카드 — 흰색 배경, border, 16px `text-secondary`

---

### 4. 저자 홈 화면 (`screen-home`)
- **목적:** 메인 대시보드 — AI 대화 시작, 진행도 확인, 알림 확인
- **배경:** `#FFF8F0`
- **레이아웃:** 스크롤 가능, 800×1280px

**Header (0~80px):**
- 배경: `#FFFFFF`, 하단 border `#E5E7EB`
- 좌: 날짜 텍스트 "4월 16일 수요일" — 20px, `#6B7280`, left 48px
- 우: 알림 아이콘 + 설정 아이콘 — 각 13px 레이블, `#E8820C`

**카드 1 — AI 인사 카드 (`card-greeting`, top 127px):**
- 크기: 752×120px, `#FFF0DC` 배경, 16px radius
- AI 아바타: 68×68px 원, `#E8820C`, "AI" 텍스트
- 말풍선: `#FFFFFF` 배경, 12px radius
  - "좋은 아침이에요, 김영숙 님 :)" — 18px, `#1F2937`
  - "오늘도 이야기 들려주세요" — 17px, `#6B7280`

**카드 2 — AI 대화 버튼 (`card-mic`, top 267px):**
- 크기: 752×520px, `#FFFFFF` 배경, border `#E5E7EB`
- "AI 말동무와 대화하기" — 22px, center
- 중앙 마이크 버튼 (대형 원형, `#E8820C`)
- 하단: "버튼을 누르면 대화방으로 이동해요" — 15px, `#9CA3AF`

**카드 3 — 진행도 (`card-progress`, top 807px):**
- 크기: 752×88px, `#FFFFFF` 배경, border
- 좌: "이번 달 18일째 대화 중" (18px) + "월말까지 12일 남았어요" (15px, secondary)
- 우: 프로그레스바 264×12px
  - 배경: `#E5E7EB`, 채움: `#E8820C` (약 60% 진행)

**카드 4 — 가족 최근 활동 (`card-family`, top 915px):**
- 크기: 752×76px, `#FFFFFF` 배경, border
- 최근 가족 활동 1줄 + 시간 + 화살표 `›`

**Tab Bar (top 1231px, height 72px):**
- 배경: `#FFFFFF`, 상단 border `#E5E7EB`
- 4개 탭: 대화하기(활성, `#E8820C`) / 내 책장 / 가족 책장 / 설정
- 활성 탭: `#E8820C` 색상
- 비활성 탭: `#6B7280` 색상, 14px

---

### 5. AI 채팅 화면 (`senior_chat_screen`)
- **목적:** AI와 실시간 음성/텍스트 대화
- **배경:** `#FFF8F0`

**Header (0~80px):**
- 뒤로 버튼 (좌, 14px `#6B7280`)
- "오늘의 대화" — 22px bold center
- 우: "오늘 3번째 대화" — 16px right, `#6B7280`
- 하단 border

**Chat Area (80~960px):**
- 배경: `#FFF8F0`
- 상하단 페이드 그라데이션 (40px, `#FFF8F0` → 투명)

**AI 말풍선:**
- 아바타: 40×40px 원, `#E8820C`, "AI" 13px bold 흰색
- 버블: `#FFF0DC` 배경, 16px radius, 좌측 꼬리 (14×16px 삼각형)
- 텍스트: 18px, `#1F2937`
- 시간: 14px, `#6B7280`

**사용자 말풍선:**
- 버블: `#FFFFFF` 배경, 1px border `#E8820C`, 우측 정렬
- 텍스트: 18px, center, `#1F2937`
- 시간: 14px right, `#6B7280`

**타이핑 인디케이터:**
- AI 아바타 + 애니메이션 점 3개

**Mic Area (960~1280px):**
- 배경: `#FFFFFF` (또는 `#FFF8F0`)
- 녹음 상태 텍스트: "..."  이탤릭, 18px
- 마이크 버튼: 120×120px 원, `#E8820C` (녹음 중 상태)
- "듣고 있어요" — 18px, `#E8820C`
- "말씀이 끝나면 자동으로 저장돼요" — 16px, `#6B7280`

---

### 6. 책 편집 Step 2 — 챕터 확인 (`senior_book_edit_chapter`)
- **목적:** AI가 정리한 이번 달 챕터 목록 확인 및 제외 처리

**Step Indicator (80~180px):**
- 배경: `#FFFFFF`
- 4단계: 표지 선택 → **챕터 확인** → 에필로그 → 출간
- 완료 스텝: `#16A34A` 원 + 체크마크
- 현재 스텝: `#E8820C` 원 + 숫자
- 미완료 스텝: `#F3F4F6` 원 + `#9CA3AF` 숫자
- 연결선: 완료 구간 `#E8820C`, 미완료 구간 `#D1D5DB`

**Guide Text (top 200px):**
- "이번 달 이야기들이에요" — 24px bold
- "마음에 들지 않는 이야기는 빼도 돼요" — 18px, secondary

**Chapter List (top 288px):**
- 각 카드: 752×148px, `#FFFFFF` 배경, border, 8px radius
- 카드 내용: 챕터 번호 + 제목(bold) + 미리보기 2줄 텍스트
- "이 이야기 빼기" 버튼: 172×36px, `#FEF2F2` 배경, `#DC2626` 텍스트
- 카드 간격: 16px

**삭제 확인 모달 (`dialog-confirm`):**
- 오버레이: `#1F2937` 45% 불투명
- 모달: 640×300px, `#FFFFFF`, 20px radius, center
- "이 이야기를 뺄까요?" — 22px bold
- 챕터명 태그: `#FFF8F0` 배경, `#E8820C` 텍스트
- 버튼 2개: "취소" (`#FFF0DC`) / "빼기" (`#FEF2F2`, `#DC2626`)

**하단 CTA (top 1160px):**
- 전체 너비 버튼, `#E8820C` 배경
- "다음으로" — 20px 흰색

---

### 7. 책 편집 Step 3 — 에필로그 (`book_edit_step3_epilogue`)
- **목적:** 이번 달 마무리 한마디 (AI 도움 + 직접 입력)

**AI 질문 카드 (top 264px):**
- 704×88px, `#FFF0DC` 배경, 16px radius
- AI 아바타(52×52px) + 화살표 + 말풍선(`#FFFFFF`)
- 텍스트: "4월 한 달, 어떤 마음이셨나요? 떠오르는 대로 말씀해 주시면 에필로그로 담아드릴게요."

**입력 방법 (top 356px):**
- **음성 입력 (추천):** 704×196px 카드, 주황 2px 테두리 (선택됨)
  - 상단 "추천" 배지: `#E8820C`
  - 마이크 버튼 + "듣고 있어요" + 안내 텍스트
- **구분선:** "또는" 텍스트 + 좌우 선
- **직접 입력:** 704×180px 카드, 텍스트에리어 (`#FFF8F0`), 글자수 카운터

**AI 미리보기 (top 808px):**
- 704×120px, `#F3F4F6` 배경
- AI가 생성한 에필로그 문장 표시
- "AI에게 다시 써달라고 하기 ›" — 15px, `#E8820C`

**하단 버튼 (top 960px):**
- "건너뛰기": 200×64px, `#FFF0DC`, `#E8820C` 텍스트
- "이 에필로그로 할게요": 484×64px, `#E8820C` 배경, 흰색 20px 텍스트

---

### 8. 책 출간 완료 (`book_edit_step4_published`)
- **목적:** 출간 축하 + 가족 알림 확인 + 다음 행동 유도

**Step Indicator:** 4단계 모두 `#16A34A` 완료 상태

**책 표지 미리보기 (top 140~540px):**
- 412×400px 영역
- 책 표지: 제목 "봄날의 기록" (20px, `#E8820C`)
- 저자: "김영숙 지음" (15px), 날짜: "2025년 4월" (14px)
- 축하 파티클 애니메이션

**출간 텍스트 (top 512px):**
- "4월 책이 나왔어요!" — 큰 제목
- "가족 책장에 올라갔어요", "가족이 곧 읽을 거예요 :)"

**가족 알림 카드 (top 628px):**
- 704×80px, `#DCFCE7` 배경
- 녹색 체크 아이콘 + "가족에게 알림을 보냈어요"
- "김민준, 이수빈, 박지영 님께 새 책 알림이 갔어요"

**액션 버튼 (top 774px):**
- "지금 바로 읽어보기": 704×72px, `#E8820C`
- "카카오로 자랑하기": `#FEF9C3` 배경, 어두운 텍스트

**이달 통계 카드:**
- 대화 18번 | 챕터 3개 | 가족 3명 (수평 분할)
- "홈으로 돌아가기" 링크

---

### 9. 가족 책장 (`senior_family_bookshelf`)
- **목적:** 어르신의 월별 책 목록 + 가족 활동 피드

**Header:**
- "엄마의 책장" — 24px bold, left 32px
- 우상단 "초대" 버튼 — 14px, `#E8820C`

**Bookshelf Area (top 80px):**
- 책들을 가로로 나열, 각 책: 154×202px
- 책 표지 구성:
  - 배경색 (4월: `#FFF0DC`, 3월: 녹색 계열)
  - 월 표시 (28px bold, 해당 월 색상)
  - "2025" (14px)
  - 구분선 + "N일의 이야기" (13px)
  - 우상단 댓글 배지: 36×36px 원, 숫자

**이번 달 내 책 카드 (top 595px):**
- 752×196px, `#FFFFFF` 배경
- "이번 달 내 책" 제목
- 프로그레스바 (704×12px, `#E8820C` / `#E5E7EB`)
- "N일 대화 완료 · 월말까지 N일 남았어요" — 16px secondary
- "책 미리보기" 버튼: 704×64px, `#FFF0DC`, `#E8820C` 텍스트

**가족 최근 활동 카드 (top 812px):**
- 752×340px, `#FFFFFF` 배경
- "가족 최근 활동" — 20px bold
- 구분선 후 활동 목록 (각 61px 높이)
  - 아바타 원(색상별 구분) + 이름 + 활동 내용 + 시간 + 활동 배지
  - 댓글: `#FFF0DC` 배지, `#E8820C`
  - 사진: `#DCFCE7` 배지, `#16A34A`
  - 하이라이트: `#FEF9C3` 배지, `#CA8A04`

**Tab Bar:** 대화하기 / 내 책장 / **가족 책장**(활성) / 설정

---

### 10. 알림 목록 (`notification_list_screen`)
- **목적:** 읽지 않은 알림 + 읽은 알림 구분 표시

**Header:**
- "뒤로" 버튼 + "알림" 제목 + "모두 읽음 처리" 버튼

**안 읽은 알림 섹션:**
- "안 읽은 알림 3개" 레이블
- 각 알림 카드 (108px 높이): 아이콘 + 내용 + 시간 + 읽지 않음 dot + 액션 버튼
  - "음성 답장하기": `#E8820C` 배경 버튼
  - "확인하러 가기": `#E8820C` 배경 버튼
  - "책 편집하러 가기": `#E8820C` 배경 버튼

**읽은 알림 섹션:**
- "읽은 알림" 레이블
- 각 알림: 희미한 스타일 (아이콘 `#F3F4F6`)
- "지난 알림 더 보기" 텍스트 링크

---

## Interactions & Behavior

### 네비게이션 플로우

```
카카오 로그인
    └─→ 역할 선택
            ├─→ [저자] 온보딩 (다단계)
            │       └─→ AI 소개 → 대화 시작하기
            │                       └─→ 저자 홈
            └─→ [독자] 독자 홈 → 가족 책장
```

### 저자 메인 플로우

```
저자 홈 (대화하기 탭)
    └─→ AI 채팅 화면 (음성 녹음)
            └─→ 대화 종료 (자동 저장)
                    └─→ 저자 홈 복귀

[월말] 홈 → 책 만들기
    └─→ Step 1: 표지 선택
    └─→ Step 2: 챕터 확인 (제외 기능 포함)
    └─→ Step 3: 에필로그 (음성/텍스트 입력)
    └─→ Step 4: 출간 완료 (가족 자동 알림)
```

### 음성 입력 동작
- 마이크 버튼 탭 → 녹음 시작
- "듣고 있어요" 상태 표시
- 말이 끝나면 자동 감지 → STT → 텍스트 변환
- AI가 응답 생성 (타이핑 인디케이터 표시)

### 챕터 제외 (삭제) 플로우
1. "이 이야기 빼기" 버튼 탭
2. 확인 모달 표시 (반투명 오버레이)
3. "빼기" 확인 → 목록에서 제거 (나중에 되돌리기 가능)
4. "취소" → 모달 닫기

### 에필로그 AI 재작성
- "AI에게 다시 써달라고 하기 ›" 탭 → AI가 새 에필로그 생성
- 반복 가능

---

## State Management

| State | Type | Description |
|-------|------|-------------|
| `userRole` | `'author' \| 'reader'` | 로그인 후 역할 |
| `currentBook` | `Book \| null` | 진행 중인 이번 달 책 |
| `chatSessions` | `ChatSession[]` | 이번 달 대화 목록 |
| `chapters` | `Chapter[]` | 생성된 챕터 목록 (included/excluded) |
| `epilogue` | `string \| null` | AI 생성 에필로그 |
| `bookEditStep` | `1 \| 2 \| 3 \| 4` | 책 편집 단계 |
| `notifications` | `Notification[]` | 알림 목록 (read/unread) |
| `familyMembers` | `FamilyMember[]` | 연결된 가족 목록 |

---

## Data Models

```typescript
interface Book {
  id: string;
  month: string; // "2025-04"
  title: string;
  authorName: string;
  coverColor: string;
  chapters: Chapter[];
  epilogue?: string;
  publishedAt?: Date;
  conversationCount: number;
}

interface Chapter {
  id: string;
  order: number;
  title: string;
  preview: string; // 1~2문장 요약
  included: boolean;
}

interface ChatSession {
  id: string;
  date: Date;
  messages: Message[];
  sessionNumber: number; // "오늘 N번째 대화"
}

interface Message {
  id: string;
  sender: 'ai' | 'user';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

interface Notification {
  id: string;
  type: 'family_comment' | 'family_photo' | 'book_ready' | 'family_joined';
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
  action?: { label: string; route: string };
}
```

---

## Assets

- **AI 아바타:** 원형 (`#E8820C` 배경, "AI" 흰색 텍스트) — 크기별: 40×40, 48×48, 52×52, 68×68px
- **마이크 아이콘:** SVG, 녹음 전/녹음 중 2가지 상태
- **책 아이콘:** SVG (탭바)
- **음파 애니메이션:** 마이크 주변 pulse 효과 (CSS animation 또는 Lottie)
- **파티클 효과:** 출간 완료 화면 축하 애니메이션
- **카카오 로그인 버튼:** 카카오 공식 로그인 버튼 가이드라인 준수

---

## Screens Index

| 파일명 | 화면 이름 | 역할 |
|--------|-----------|------|
| `login_kakao_screen` | 카카오 로그인 | 공통 |
| `role_select_screen` | 역할 선택 | 공통 |
| `screen-role-select` | 역할 선택 (대안) | 공통 |
| `senior_onboarding_ai_intro` | AI 소개 온보딩 | 저자 |
| `screen-home` / `author_home_simple` | 저자 홈 | 저자 |
| `senior_chat_screen` | AI 채팅 | 저자 |
| `ai_voice_settings` | AI 음성 설정 | 저자 |
| `ai_memory_screen` | AI 기억 관리 | 저자 |
| `senior_book_edit_cover` | 책 편집 Step 1 표지 | 저자 |
| `senior_book_edit_chapter` | 책 편집 Step 2 챕터 | 저자 |
| `book_edit_step3_epilogue` | 책 편집 Step 3 에필로그 | 저자 |
| `book_edit_step4_published` | 책 출간 완료 | 저자 |
| `senior_book_read` | 책 읽기 | 저자 |
| `senior_family_bookshelf` | 가족 책장 | 저자 |
| `reader_home_screen` | 독자 홈 | 독자 |
| `reader_profile_setup` | 독자 프로필 설정 | 독자 |
| `reader_profile_edit_screen` | 독자 프로필 편집 | 독자 |
| `reader_settings_screen` | 독자 설정 | 독자 |
| `notification_list_screen` | 알림 목록 | 공통 |
| `notification_settings_screen` | 알림 설정 | 공통 |
| `connected_family_screen` | 연결된 가족 | 공통 |
| `family_invite_screen` | 가족 초대 | 공통 |
| `profile_edit_screen` | 프로필 편집 | 공통 |
| `settings_screen_updated` | 설정 | 공통 |
| `screen-profile-setup` | 프로필 설정 | 공통 |
| `screen-login` | 로그인 (대안) | 공통 |

---

## Notes for Developers

1. **음성 인터페이스 우선:** 어르신 대상이므로 모든 주요 액션은 음성으로도 수행 가능해야 함
2. **큰 터치 타깃:** 모든 버튼 최소 60×60px 이상 권장
3. **명확한 피드백:** 음성 인식 중/완료/오류 상태를 시각적으로 명확히 표현
4. **월간 주기:** 책은 한 달 단위로 생성됨. 매월 1일 초기화 로직 필요
5. **카카오 SDK:** 로그인 + 카카오 공유하기 기능 (카카오 개발자 SDK 사용)
6. **실시간 알림:** 가족이 댓글/사진/하이라이트 추가 시 저자에게 푸시 알림
7. **STT 연동:** 네이버 Clova Speech 또는 Google STT 권장 (한국어 특화)
8. **AI 대화 엔진:** 챕터 자동 생성 + 에필로그 생성 위한 LLM 연동 필요
