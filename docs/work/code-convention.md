# 코드 컨벤션

> **문서 버전**: v1.0
> **작성일**: 2026-04-17
> **관련 문서**: [role-assignment.md](./role-assignment.md) · [api-spec.md](./api-spec.md) · [git-workflow.md](./git-workflow.md)
> **적용 범위**: `frontend/` (React 19 + TypeScript + Vite + Tailwind v4 + Supabase JS)

---

## 0. 이 문서를 읽는 법

- 본 문서는 **ESLint/Prettier가 자동으로 잡아주는 규칙은 생략**하고, 2인이 합의해야 하는 사항만 담습니다.
- 각 절 끝의 **[도입 예정]** 표기는 아직 `frontend/package.json`에 없는 라이브러리를 전제로 한 규약입니다. 해당 라이브러리 도입 PR과 함께 활성화합니다.
- 도입 시점은 [role-assignment.md §2](./role-assignment.md#2-기능별-분담표) 기능 번호를 기준으로 합니다.

---

## 1. 기본 원칙 (한눈에 보기)

| 항목 | 규약 | 비고 |
|------|------|------|
| 들여쓰기 | 스페이스 2칸 | ESLint 설정 |
| 세미콜론 | 사용하지 않음 | ESLint 설정 |
| 따옴표 | 싱글 쿼트(`'`) 기본, JSX 속성은 더블(`"`) | |
| 함수 길이 | 50줄 이하, 초과 시 분리 검토 | 컴포넌트는 §5 별도 기준 |
| any | 사용 금지 | 불가피 시 `unknown` + narrowing |
| 매직넘버 | 금지, `src/constants/`로 추출 | |
| 인라인 style | 금지 (애니메이션 동적값 예외) | |
| 파일 인코딩 | UTF-8, LF 개행 | `.gitattributes`로 강제 |

---

## 2. 파일·폴더 네이밍

### 2.1 파일명

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `BookshelfItem.tsx`, `ChapterEditor.tsx` |
| 훅 | camelCase + `use` 접두사 | `useVoiceChat.ts`, `useBookshelf.ts` |
| 유틸·라이브러리 | camelCase | `formatDate.ts`, `supabase.ts` |
| 상수 정의 파일 | camelCase | `bookLimits.ts`, `errorMessages.ts` |
| 페이지 | 케밥케이스 소문자 | `src/pages/bookshelf/index.tsx` |
| 타입 정의 파일 | camelCase | `database.ts`, `domain.ts` |
| 테스트 | 대상과 동일 + `.test.ts(x)` | `BookshelfItem.test.tsx` |

### 2.2 폴더 구조 (확정 시점: F-02 완료 직후)

```
frontend/src/
├── pages/              # 라우트 단위, 도메인별 소문자 케밥
├── features/           # 기능 단위 묶음 (컴포넌트 + 훅 + 로컬 유틸)
├── components/
│   ├── ui/             # shadcn/ui 생성 컴포넌트 (수정은 여기서만) [도입 예정]
│   └── common/         # 프로젝트 공통 컴포넌트
├── hooks/              # 전역 재사용 훅
├── lib/                # 외부 SDK 래퍼 (supabase.ts 등)
├── stores/             # Zustand 스토어 [도입 예정: F-10 이후]
├── types/              # database.ts, domain.ts
├── constants/          # 매직넘버·문구·enum
└── utils/              # 순수 함수 유틸
```

### 2.3 배럴 파일(`index.ts`)

- `features/*` 경계에서만 허용 (외부에서 내부 구조 은닉 목적)
- `components/ui/`, `components/common/`에서는 **금지** (순환참조·트리셰이킹 저해)

---

## 3. import 순서

> `eslint-plugin-import`는 도입 예정이므로 당분간 수동 규약으로 운영합니다.

순서: **① React → ② 외부 라이브러리 → ③ 절대경로(`@/`) → ④ 상대경로 → ⑤ 스타일·타입**
각 그룹 사이 빈 줄 1개.

```ts
// ① React
import { useState, useEffect } from 'react'

// ② 외부 라이브러리
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'

// ③ 절대경로 (vite.config.ts의 @/ alias 설정 이후 사용)
import { supabase } from '@/lib/supabase'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'

// ④ 상대경로
import { ChapterRow } from './ChapterRow'

// ⑤ 스타일·타입
import type { Chapter } from '@/types/domain'
import './BookDetail.css'
```

> **경로 별칭(`@/`) 주의**: `vite.config.ts`와 `tsconfig.json`에 `paths` 설정이 선행되어야 합니다. 설정 전까지는 상대경로를 허용하되, 설정 PR 이후로는 `@/`를 사용합니다.

---

## 4. TypeScript 규약

### 4.1 타입 금지·권장

- `any` 금지. 외부 라이브러리 타입이 부실한 경우 `unknown`으로 받고 타입 가드로 좁힙니다.
- `as` 캐스팅 최소화. 꼭 필요한 경우 **바로 위 줄에 한글 주석으로 이유**를 남깁니다.
- non-null assertion(`!`) 금지. `if (!x) return` 패턴으로 해결합니다.

### 4.2 `interface` vs `type`

- **공개 오브젝트 형태**(Props, API 응답): `interface`
- **유니온·튜플·매핑·유틸리티**: `type`

```ts
// 컴포넌트 Props → interface
interface BookshelfItemProps {
  book: Book
  onClick: (id: string) => void
}

// 유니온 → type
type BookStatus = 'draft' | 'generating' | 'published' | 'failed'
```

### 4.3 Supabase 타입 동기화

- DB 스키마 생성 타입은 **`src/types/database.ts`에서만 직접 import**, 다른 파일은 반드시 re-export된 이름을 사용합니다.
- 도메인 조합 타입(조인 결과 등)은 `src/types/domain.ts`에 모읍니다.
- 생성 명령과 갱신 규칙은 [api-spec.md §1 타입 동기화 규칙](./api-spec.md#1-개요) 참조.

```ts
// ❌ 금지: 다른 파일에서 직접 참조
import type { Database } from '@/types/database'
type Book = Database['public']['Tables']['books']['Row']

// ✅ domain.ts에서 정리한 타입을 사용
import type { Book, BookWithChapters } from '@/types/domain'
```

---

## 5. React 컴포넌트 패턴

### 5.1 선언 방식

- **함수 선언식 권장**: `function Component() { ... }`
- `React.FC` / `React.FunctionComponent` 금지 (children 자동 주입 등 암묵적 동작이 혼란을 줌)
- Props 타입은 `Props` 또는 `컴포넌트명Props` 인터페이스로 **명시**합니다.

```tsx
interface BookshelfItemProps {
  book: Book
  onOpen: (id: string) => void
}

function BookshelfItem({ book, onOpen }: BookshelfItemProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(book.id)}
      className="min-h-11 text-lg"
    >
      {book.title}
    </button>
  )
}

export default BookshelfItem
```

### 5.2 크기 기준

- **함수 50줄**, **컴포넌트 100줄** (JSX·Props 타입·핸들러 포함이라 함수보다 여유)
- 초과 시: 자식 컴포넌트 추출 → 커스텀 훅 추출 → 유틸 분리 순으로 검토
- 강제 규칙이 아닌 **분리 검토 트리거**입니다. 응집도가 높아 분리하면 오히려 가독성이 떨어지는 경우 유지 가능

### 5.3 조건부 렌더링

- early return을 우선 사용합니다. 삼항 중첩 2단계 이상 금지.

```tsx
// ✅ early return
function ChapterView({ chapter }: Props) {
  if (chapter.status === 'deleted') return null
  if (chapter.status === 'loading') return <ChapterSkeleton />

  return <ChapterContent chapter={chapter} />
}
```

### 5.4 key props

- 리스트 key는 **안정적이고 고유한 id** 사용. index 사용 금지 (리오더·삭제 시 문제).

---

## 6. Tailwind / 스타일링

### 6.1 클래스 병합 — `cn()` 유틸 **[도입 예정: shadcn/ui 설치 시]**

```ts
// src/lib/cn.ts (도입 예정)
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// 역할: Tailwind 클래스 중복을 병합하고 조건부 클래스를 안전하게 결합
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

사용 예시:

```tsx
<button className={cn('min-h-11 text-lg', isActive && 'bg-primary', className)} />
```

### 6.2 인라인 style 금지

- 정적 스타일은 Tailwind 클래스로만 표현합니다.
- **예외**: 애니메이션 동적 계산값(`transform`, `transition-delay` 등). 이 경우 변수명으로 의도를 드러냅니다.

```tsx
// ✅ 허용: 런타임 계산 필요
const delay = `${index * 100}ms`
<div style={{ transitionDelay: delay }} />
```

### 6.3 시니어 친화 스타일 기준 (지금부터 적용)

- **최소 본문 폰트**: `text-lg` (18px) 이상
- **터치 타깃 최소 크기**: `min-h-11 min-w-11` (44px)
- **대비**: 본문 텍스트 대 배경 대비 WCAG AA 이상 (4.5:1)
- **포커스 링**: Tailwind `focus-visible:ring-2` 기본 유지

### 6.4 shadcn/ui 사용 규칙 **[도입 예정]**

- 생성된 컴포넌트는 `src/components/ui/` 내부에서만 수정합니다.
- 외부(`features/`, `pages/`)에서는 composition(래핑·props 확장)으로만 변형합니다.

---

## 7. 상태 관리 규칙 **[도입 예정: F-10 이후 TanStack Query / Zustand 설치]**

### 7.1 서버 상태 — TanStack Query

- 모든 Supabase read 호출은 `useQuery` / `useInfiniteQuery`로 감쌉니다.
- mutation은 `useMutation` + `queryClient.invalidateQueries`로 캐시 무효화.
- **Query key 컨벤션**: `['domain', 'entity', id?, params?]`

```ts
// 책장 목록
queryKey: ['bookshelf', 'books', userId]

// 책 상세
queryKey: ['book', 'detail', bookId]

// 챕터 목록 (책에 속함)
queryKey: ['book', 'chapters', bookId]
```

### 7.2 전역 UI 상태 — Zustand

- `src/stores/` 하위, 스토어 한 파일 = 한 도메인.
- 스토어명: `use{도메인}Store` (예: `useAudioStore`).
- 서버 상태는 **절대** Zustand에 넣지 않습니다 (TanStack Query가 소유).

### 7.3 로컬 상태 — useState / useReducer

- props drilling이 **3단계를 넘기면** Context API 또는 Zustand 도입 검토.
- 상태 형태가 복잡(필드 4개 이상, 상호 의존)하면 `useReducer`.

---

## 8. 에러 처리

### 8.1 Supabase 호출

- `{ data, error }` 둘 다 **명시적으로 체크**합니다. `data!` 같은 단언 금지.

```ts
const { data, error } = await supabase.from('books').select('*').eq('user_id', userId)

if (error) {
  console.error('[bookshelf] 책 목록 조회 실패', error)
  throw error
}

return data
```

### 8.2 사용자 노출 vs 개발자 로그

- **사용자 노출**: 토스트·모달로 한국어 친화 문구. 에러 상세 노출 금지.
- **개발자 로그**: `console.error('[도메인] 상황', error)`. 도메인 접두사로 필터 용이.

### 8.3 Edge Function 호출 재시도

- 기본 정책: **최대 3회, 지수 백오프**(1s → 2s → 4s).
- 재시도 금지 케이스: 인증 실패(401), 권한 실패(403), 유효성 오류(422).
- 공통 재시도 래퍼는 `src/lib/invokeWithRetry.ts`(도입 예정)에서 제공할 예정. 호출 상세 스펙은 [api-spec.md §7](./api-spec.md#7-edge-function-호출-공통-패턴) 참조.

---

## 9. 주석 규칙

### 9.1 필수 주석 (한 줄로 충분)

- **함수·메서드·훅**: 상단에 "무엇을 하는지" 한 줄 요약
- **외부 라이브러리·MCP·Edge Function 호출부**: 해당 호출이 무엇을 하는지 역할 한 줄
- **RPC / Realtime 구독부**: 어떤 서버 자원을 쓰는지 한 줄

```ts
// 역할: 특정 사용자의 책장 전체를 최신순으로 조회
async function fetchBookshelf(userId: string) {
  // Supabase REST 호출 — books 테이블 select (RLS로 본인 것만 노출됨)
  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}
```

### 9.2 "왜" 주석 (복잡한 로직)

- 단순한 동작 설명은 불필요. 코드가 **왜 이렇게 되어 있는지**(제약·버그 우회·설계 결정)만 남깁니다.

```ts
// 왜: Whisper API가 60초를 넘기면 timeout이 발생하므로,
// 음성 청크를 45초 단위로 쪼개 순차 전송한다.
const MAX_CHUNK_SECONDS = 45
```

### 9.3 예제·참고 코드

- 온보딩 자료, 스니펫 파일, 테스트 픽스처 등에는 **한글로 흐름을 상세히** 주석. 실제 프로덕션 코드는 간결 유지.

### 9.4 금지

- 코드가 이미 드러내는 내용 중복 설명(`// i를 1 증가` 같은 주석)
- 주석 처리된 죽은 코드 방치 — 삭제 후 Git 이력에 맡깁니다.

---

## 10. 네이밍 금칙 · 상수

### 10.1 매직넘버

- 숫자·문자열 리터럴이 **의미를 가지면** 상수로 추출합니다.

```ts
// src/constants/bookLimits.ts
export const MAX_CHAPTERS_PER_BOOK = 30
export const MAX_AUDIO_DURATION_SEC = 600
export const SIGNED_URL_TTL_SEC = 60 * 60 // 1시간
```

### 10.2 Boolean 네이밍

- `is*`, `has*`, `can*`, `should*` 접두사.
  - `isLoading`, `hasError`, `canEdit`, `shouldAutoSave`

### 10.3 이벤트 핸들러

| 위치 | 접두사 | 예시 |
|------|--------|------|
| 컴포넌트 내부 핸들러 | `handle*` | `handleClick`, `handleSubmit` |
| 부모에게 받는 콜백 prop | `on*` | `onOpen`, `onSelectChapter` |

```tsx
interface Props {
  onSelectChapter: (id: string) => void
}

function ChapterList({ onSelectChapter }: Props) {
  const handleRowClick = (id: string) => {
    // 내부 전처리 후 prop 콜백 호출
    onSelectChapter(id)
  }
  // ...
}
```

### 10.4 기타 네이밍

- **상수**: 모듈 전역 불변 값은 `SCREAMING_SNAKE_CASE`.
- **컴포넌트 prop의 함수**: 동사로 시작(`onClose` ○ / `closeHandler` ×).
- **enum 대신 union string**: TS enum은 원칙적으로 쓰지 않고 `type X = 'a' | 'b'` 사용.

---

## 11. 체크리스트 (PR 셀프 리뷰용)

- [ ] `any` 사용 없음 (또는 `unknown` + 타입 가드)
- [ ] 매직넘버 없음 (`src/constants/`로 추출)
- [ ] 함수 50줄 / 컴포넌트 100줄 이내 (초과 시 분리 검토 완료)
- [ ] Supabase 호출부에서 `data`·`error` 모두 처리
- [ ] 터치 타깃 `min-h-11` 이상, 본문 `text-lg` 이상
- [ ] 도입 예정 라이브러리를 이미 사용하고 있지 않은지
- [ ] 인라인 style 없음 (동적 계산값 예외 주석 있음)
- [ ] 파일·훅·컴포넌트 네이밍 규약 부합
- [ ] 주석: 함수·외부 호출부에 역할 한 줄 있음

---

> 본 문서는 2인 합의로만 개정됩니다. 변경 제안은 PR로 올리고, 이슈 제목에 `[convention]` 태그를 사용합니다.
