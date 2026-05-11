# API 명세서

> **문서 버전**: v1.0
> **작성일**: 2026-04-17
> **관련 문서**: [role-assignment.md](./role-assignment.md) · [code-convention.md](./code-convention.md) · [git-workflow.md](./git-workflow.md) · [erd.md](../dev/erd.md) · [FRD.md](../dev/FRD.md)
> **적용 범위**: `frontend/` ↔ Supabase (DB · RPC · Realtime · Storage · Edge Functions)

---

## 0. 이 문서를 읽는 법

- 본 문서는 **백엔드 담당(권오인)이 구현한 서버 자원을 프론트엔드 담당(이지형)이 막힘 없이 호출**할 수 있게 하는 계약서입니다.
- [role-assignment.md §4](./role-assignment.md#4-연결-지점--인터페이스-약속)의 요약 표를 **실호출 예시·에러 케이스**까지 확장한 상세 버전입니다.
- RPC / Realtime / Storage / Edge Function 네 영역을 모두 다루며, 각 영역 마지막에 **에러 처리**를 붙였습니다.
- 스키마 근거: [erd.md §3 테이블 정의서](../dev/erd.md), [erd.md §6 RLS 정책](../dev/erd.md).

---

## 1. 개요

### 1.1 클라이언트 초기화

```ts
// src/lib/supabase.ts
// 역할: 프로젝트 전역에서 사용하는 단일 Supabase 클라이언트 인스턴스
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

- 인증 토큰은 **Supabase 세션이 자동으로 헤더에 주입**되므로 호출부에서 별도 처리 불필요.
- `service_role` 키는 **절대 클라이언트 번들에 포함하지 않음**. Edge Function 내부에서만 사용.

### 1.2 타입 동기화 규칙

| 단계 | 명령 / 작업 | 담당 |
|------|-------------|------|
| ① 마이그레이션 반영 | `supabase db push` (또는 MCP `apply_migration`) | 권오인 |
| ② 타입 재생성 | `npx supabase gen types typescript --project-id <id> > frontend/src/types/database.ts` | 권오인 |
| ③ 도메인 타입 업데이트 | 조인/가공이 필요한 경우 `frontend/src/types/domain.ts` 수정 | 둘 공동 |
| ④ PR | `database.ts` 변경 커밋 포함, PR 본문에 상대방 멘션 | 권오인 |

> 규칙 위반 시 파급 범위가 크므로 [git-workflow.md §3 공유 인터페이스 영향](./git-workflow.md)에 따라 PR 체크리스트 표기 필수.

### 1.3 공통 호출 패턴

```ts
// 모든 Supabase 호출은 { data, error }를 모두 체크 — code-convention §8.1
const { data, error } = await supabase.from('books').select('*').eq('senior_id', seniorId)
if (error) {
  console.error('[bookshelf] 책 목록 조회 실패', error)
  throw error
}
```

---

## 2. RPC 함수 명세

> 전체 7개. [role-assignment.md §4.2](./role-assignment.md#42-권오인이-제공하는-rpc--함수) 확장판.
> 시그니처 변경 시 `src/types/database.ts` 재생성 필수, PR 제목에 `[api!]` 접두사.

### 2.1 `soft_delete_chapter`

| 항목 | 내용 |
|------|------|
| 시그니처 | `soft_delete_chapter(chapter_id uuid) → void` |
| 사용처 | F-12 어르신 책 편집 — 챕터 숨김 (되돌리기 가능) |
| 내부 동작 | `chapters.is_deleted = true`, `deleted_at = now()` UPDATE |
| 권한 | 해당 책의 어르신 본인만 (RLS로 검증) |

```ts
// 역할: 챕터를 soft-delete 처리하고 되돌리기 UI 띄우기 위해 호출
const { error } = await supabase.rpc('soft_delete_chapter', { chapter_id: chapterId })
if (error) throw error
```

**에러 케이스**
- `42501` (권한 없음): 본인 소유 책이 아님 → 토스트 "권한이 없습니다"
- `PGRST116`: 존재하지 않는 `chapter_id` → 토스트 "챕터를 찾을 수 없어요"

---

### 2.2 `restore_chapter`

| 항목 | 내용 |
|------|------|
| 시그니처 | `restore_chapter(chapter_id uuid) → void` |
| 사용처 | F-12 되돌리기 |
| 내부 동작 | `is_deleted = false`, `deleted_at = null` UPDATE |
| 권한 | 어르신 본인만 |

```ts
const { error } = await supabase.rpc('restore_chapter', { chapter_id: chapterId })
if (error) throw error
```

---

### 2.3 `update_chapter_title`

| 항목 | 내용 |
|------|------|
| 시그니처 | `update_chapter_title(chapter_id uuid, new_title text) → void` |
| 사용처 | F-12 챕터 제목 편집 |
| 내부 동작 | 제목 UPDATE. 빈 문자열·100자 초과 시 함수 내부에서 RAISE EXCEPTION |
| 권한 | 어르신 본인만 |

```ts
const { error } = await supabase.rpc('update_chapter_title', {
  chapter_id: chapterId,
  new_title: title.trim(),
})
if (error) throw error
```

**에러 케이스**
- `22023` (유효성): 빈 제목 또는 길이 초과 → 폼 유효성 에러로 표시

---

### 2.4 `select_cover`

| 항목 | 내용 |
|------|------|
| 시그니처 | `select_cover(book_id uuid, cover_id uuid) → void` |
| 사용처 | F-13 표지 선택 |
| 내부 동작 | `books.cover_image_url`에 `cover_images` 테이블 조회한 URL 복사 |
| 권한 | 어르신 본인만 |

```ts
const { error } = await supabase.rpc('select_cover', {
  book_id: bookId,
  cover_id: selectedCoverId,
})
if (error) throw error
```

---

### 2.5 `publish_book`

| 항목 | 내용 |
|------|------|
| 시그니처 | `publish_book(book_id uuid, dedication text) → void` |
| 사용처 | F-13 출간 승인 (핵심 트랜잭션) |
| 내부 동작 | **단일 트랜잭션**으로: ① `books.status = 'published'`, `published_at = now()`, `dedication` 저장 → ② `family_links` 조회해 수락된 가족 전원에게 `notifications` INSERT (type=`new_book`) |
| 권한 | 어르신 본인만 |

```ts
// 역할: 책 출간 + 가족 N명에게 알림 일괄 발송을 단일 RPC로 처리
const { error } = await supabase.rpc('publish_book', {
  book_id: bookId,
  dedication: dedicationText,
})
if (error) throw error
```

**에러 케이스**
- `42501`: 소유권 없음 → 권한 에러 토스트
- `23514` (체크 제약): 이미 `published` 상태 → 토스트 "이미 출간된 책이에요"
- `22023`: dedication이 500자 초과 → 폼 유효성 에러

---

### 2.6 `retry_book_generation`

> ⚠️ **사전 조건**: 이 RPC가 참조하는 `book_generation_jobs` 테이블은 현재 [erd.md §3](../dev/erd.md)에 정의되어 있지 않습니다. [role-assignment.md §5.1](./role-assignment.md#51-테이블--담당)에는 실재 예정 테이블로 명시되어 있으니, **구현 전 ERD 보강 PR이 선행**되어야 합니다. 아래 시그니처·동작은 보강 시 조정될 수 있습니다.

| 항목 | 내용 |
|------|------|
| 시그니처 | `retry_book_generation(job_id uuid) → void` |
| 사용처 | F-08 책 생성 실패 시 수동 재시도 |
| 내부 동작 | `book_generation_jobs`의 job을 재큐잉하여 Edge Function 워커를 다시 트리거 (상세는 ERD 보강 시 확정) |
| 권한 | 어르신 본인 또는 가족 관리자 |

```ts
const { error } = await supabase.rpc('retry_book_generation', { job_id: jobId })
if (error) throw error
```

**에러 케이스**
- `42501`: 권한 없음 → 토스트 "권한이 없어요."
- `23514`: ERD 보강 시 정의될 상태/제약 조건 위반 (예: 이미 완료된 job, 재시도 한도 초과) → 맥락별 문구로 매핑

---

### 2.7 `create_signed_reply_audio_url`

| 항목 | 내용 |
|------|------|
| 시그니처 | `create_signed_reply_audio_url(reply_id uuid) → text` |
| 사용처 | F-16 어르신 답글 오디오 재생 |
| 내부 동작 | `replies.audio_url`에 저장된 `reply-audio` 버킷 경로를 기준으로 signed URL 발급(TTL 1시간) |
| 권한 | 어르신 본인 또는 해당 댓글을 단 가족 |
| 반환 | `text` (signed URL 문자열) |

```ts
// 역할: 비공개 reply-audio 버킷의 오디오 파일 재생을 위한 1시간짜리 signed URL 수령
const { data, error } = await supabase.rpc('create_signed_reply_audio_url', {
  reply_id: replyId,
})
if (error) throw error

const audioUrl = data as string
const audio = new Audio(audioUrl)
audio.play()
```

**에러 케이스**
- `42501`: 권한 없음 (댓글 작성자·어르신 외의 가족이 접근 시)
- `PGRST116`: 존재하지 않는 `reply_id`

---

### 2.8 RPC 공통 에러 처리 패턴

```ts
import type { PostgrestError } from '@supabase/supabase-js'

// 역할: RPC 에러 코드를 UX 문구로 매핑 (공통 에러 표는 §5)
function mapRpcError(error: PostgrestError): string {
  switch (error.code) {
    case '42501': return '권한이 없어요.'
    case '23514': return '요청을 처리할 수 없어요.'
    case '22023': return '입력값을 확인해 주세요.'
    case 'PGRST116': return '대상을 찾지 못했어요.'
    default: return '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.'
  }
}
```

---

## 3. Realtime 채널 명세

> 전체 3개. [role-assignment.md §4.3](./role-assignment.md#43-realtime-채널-규약) 확장판.
> 모든 구독은 `useEffect` 내부에서 생성하고 cleanup에서 해제합니다.

### 3.1 `notifications:user:{user_id}` — 개인 알림

| 항목 | 내용 |
|------|------|
| 대상 테이블 | `notifications` |
| 이벤트 | `INSERT` |
| 필터 | `recipient_id=eq.{currentUserId}` ([erd.md §3.12](../dev/erd.md) 수신자 컬럼) |
| 용도 | F-17 알림 벨 실시간 카운트 증가 |
| 페이로드 타입 | `Notification` (`src/types/domain.ts`에서 re-export) |

> **채널명 vs 필터 컬럼 주의**: 채널 이름은 사람이 읽기 쉬운 관례로 `notifications:user:{user_id}`를 쓰지만, Postgres Changes 필터의 실제 컬럼명은 **`recipient_id`**입니다.

```ts
// src/features/notifications/hooks/useNotificationChannel.ts
// 역할: 로그인 사용자의 알림 INSERT 이벤트를 실시간 수신
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/domain'

export function useNotificationChannel(userId: string, onInsert: (n: Notification) => void) {
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications:user:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          // 필터의 실제 컬럼은 recipient_id (채널명의 user는 관례)
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          // 새 알림 수신 시 콜백 호출
          onInsert(payload.new as Notification)
        }
      )
      .subscribe()

    // 언마운트·userId 변경 시 반드시 해제
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, onInsert])
}
```

### 3.2 `comments:chapter:{chapter_id}` — 챕터 댓글 스트림

| 항목 | 내용 |
|------|------|
| 대상 테이블 | `comments` |
| 이벤트 | `INSERT`, `UPDATE` |
| 필터 | `chapter_id=eq.{chapterId}` |
| 용도 | F-15 댓글 실시간 표시/수정 반영 |

```ts
const channel = supabase
  .channel(`comments:chapter:${chapterId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'comments', filter: `chapter_id=eq.${chapterId}` },
    (payload) => handleInsert(payload.new)
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'comments', filter: `chapter_id=eq.${chapterId}` },
    (payload) => handleUpdate(payload.new)
  )
  .subscribe()

return () => supabase.removeChannel(channel)
```

### 3.3 `replies:comment:{comment_id}` — 답글 스트림

| 항목 | 내용 |
|------|------|
| 대상 테이블 | `replies` |
| 이벤트 | `INSERT` |
| 필터 | `comment_id=eq.{commentId}` |
| 용도 | F-15/F-16 어르신 답글 실시간 수신 |

```ts
const channel = supabase
  .channel(`replies:comment:${commentId}`)
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'replies', filter: `comment_id=eq.${commentId}` },
    (payload) => appendReply(payload.new)
  )
  .subscribe()

return () => supabase.removeChannel(channel)
```

### 3.4 오프라인·재접속 복구 패턴

네트워크가 끊겼다가 돌아왔을 때 Realtime은 **놓친 이벤트를 재전송하지 않습니다.** 다음 순서로 복구:

```ts
// 역할: 재접속 후 누락분을 REST로 백필하고 Realtime을 다시 구독
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    // 구독 성공 시 최신 데이터 재조회
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('created_at', { ascending: true })
    if (data) setComments(data)
  }
})
```

### 3.5 Realtime 공통 주의사항

- **구독 해제 누락 시 메모리 누수**. 반드시 `useEffect` cleanup에서 `removeChannel`.
- 한 페이지에서 동일 채널명 중복 구독 금지 — 필터를 달리해 채널명을 분리하거나 상위에서 끌어올립니다.
- RLS로 자동 필터링되므로 본인이 볼 수 없는 row는 **이벤트 자체가 오지 않습니다.**

---

## 4. Storage 경로 규약

> 버킷 3개. [role-assignment.md §4.4](./role-assignment.md#44-storage-경로-규칙) 확장판.

### 4.1 `avatars` 버킷 (public)

| 항목 | 내용 |
|------|------|
| 공개 여부 | public |
| 경로 패턴 | `{user_id}/{timestamp}.{ext}` |
| 업로드 주체 | 각 사용자 (이지형 UI) |
| 허용 형식 | `image/jpeg`, `image/png`, `image/webp` |
| 크기 제한 | 5 MB |
| 공개 URL | `supabase.storage.from('avatars').getPublicUrl(path)` |

```ts
// 역할: 사용자 프로필 아바타 업로드 + public URL 획득
async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })
  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
```

**에러 케이스**
- `413` Payload Too Large: 5MB 초과 → 토스트 "파일이 너무 커요 (최대 5MB)"
- `415` Unsupported Media Type: 허용 외 형식

---

### 4.2 `book-covers` 버킷 (public, 업로드는 service_role)

| 항목 | 내용 |
|------|------|
| 공개 여부 | public (조회만) |
| 경로 패턴 | `{senior_id}/{book_id}/{cover_id}.webp` |
| 업로드 주체 | 권오인 Edge Function(`generate-cover`) |
| 허용 형식 | `image/webp` |
| 클라이언트 업로드 | **금지** (RLS로 차단) |

```ts
// 프론트는 조회만 — books.cover_image_url을 그대로 <img src>로 사용
// 업로드 로직은 클라이언트에 두지 않는다
```

---

### 4.3 `reply-audio` 버킷 (private, signed URL)

| 항목 | 내용 |
|------|------|
| 공개 여부 | private |
| 경로 패턴 | `{senior_id}/{reply_id}.webm` |
| 업로드 주체 | 어르신 본인 (이지형 UI) |
| 허용 형식 | `audio/webm` |
| 크기 제한 | 10 MB |
| 다운로드 URL | RPC `create_signed_reply_audio_url` (§2.7) — TTL 1시간 |

```ts
// 역할: 어르신이 녹음한 답글 오디오 업로드 (업로드 후 replies row는 별도 INSERT)
async function uploadReplyAudio(seniorId: string, replyId: string, blob: Blob) {
  const path = `${seniorId}/${replyId}.webm`

  const { error } = await supabase.storage
    .from('reply-audio')
    .upload(path, blob, {
      contentType: 'audio/webm',
      upsert: false,
    })
  if (error) throw error

  return path
}

// 재생 시에는 반드시 RPC로 signed URL 발급 (public URL 사용 금지)
const { data: signedUrl } = await supabase.rpc('create_signed_reply_audio_url', {
  reply_id: replyId,
})
```

---

### 4.4 Storage 공통 규칙

- 파일명에 **한글·공백·특수문자 금지**. UUID나 timestamp 기반으로 생성.
- `upsert: true`는 덮어쓰기 의도가 명확할 때만. 기본 `false`.
- 업로드 성공 후 **DB row INSERT가 실패하면 Storage에 고아 파일이 남습니다** — 가능하면 DB 먼저 INSERT, 그 다음 업로드 순서. 실패 시 저장된 파일 삭제 처리.

---

## 5. 공통 에러 코드 표

| 코드 | 의미 | 주 발생 상황 | 권장 UX |
|------|------|------------|---------|
| `42501` | insufficient_privilege (권한 없음) | RLS 차단 | 토스트 "권한이 없어요." |
| `23505` | unique_violation (중복) | 이메일·초대 코드 중복 | 폼 에러 "이미 사용 중이에요." |
| `23503` | foreign_key_violation | 존재하지 않는 참조 | 토스트 "대상을 찾지 못했어요." |
| `23514` | check_violation | 상태 전이 위반 등 | 맥락별 문구 (§2 각 RPC 참조) |
| `22023` | invalid_parameter_value | 입력값 유효성 실패 | 폼 유효성 에러 |
| `PGRST116` | no rows found | 조회 결과 없음 | 빈 상태 UI 또는 404 |
| `PGRST301` | JWT expired / invalid | 세션 만료 | 로그인 화면으로 리다이렉트 |
| `storage/413` | Payload Too Large | 파일 크기 초과 | "파일이 너무 커요" |
| `storage/415` | Unsupported Media Type | 허용 외 MIME | "지원하지 않는 형식이에요" |

> 매핑 유틸: `src/lib/errorMessages.ts`(도입 시점: F-02 이후)에서 단일 함수로 관리 권장.

---

## 6. 변경 프로세스

공유 인터페이스가 변경되는 모든 PR은 다음 규칙을 따릅니다 ([git-workflow.md §3](./git-workflow.md) 공유 인터페이스 영향 체크리스트와 연동).

1. **RPC 추가·시그니처 변경**: `src/types/database.ts` 재생성 커밋 포함, PR 본문에 상대방 멘션, PR 제목 `[api!]` 접두사 (breaking).
2. **Realtime 채널 규약 변경**: 본 문서 §3 갱신 PR을 **먼저** 머지한 뒤 코드 적용 PR 올림.
3. **Storage 경로 변경**: 기존 데이터 마이그레이션 스크립트 동반 필수.
4. **Edge Function 엔드포인트 변경**: 본 문서 §7 업데이트 + 프론트 호출부 수정 PR 동시 제출.

---

## 7. Edge Function 호출 공통 패턴

> 개별 Function의 입출력 스펙은 **구현 시점에 본 절 하위 subsection으로 추가**합니다.

### 7.1 기본 호출

```ts
// 역할: Supabase Edge Function 호출 공통 래퍼
import { supabase } from '@/lib/supabase'

interface InvokeResult<T> {
  data: T | null
  error: Error | null
}

async function invokeFunction<TReq, TRes>(
  name: string,
  body: TReq
): Promise<InvokeResult<TRes>> {
  const { data, error } = await supabase.functions.invoke<TRes>(name, { body })
  if (error) {
    console.error(`[edge:${name}] 호출 실패`, error)
    return { data: null, error }
  }
  return { data, error: null }
}
```

### 7.2 재시도 정책 (code-convention §8.3과 동일)

- 최대 3회, 지수 백오프: 1s → 2s → 4s
- 재시도 **금지** 코드: 401, 403, 422
- 재시도 로직은 `src/lib/invokeWithRetry.ts`(도입 예정)에 단일화

### 7.3 스트리밍 응답 처리 (voice-chat 전용 참고)

```ts
// 역할: LLM 토큰 스트림을 ReadableStream으로 수신해 UI에 점진 출력
const response = await fetch(`${SUPABASE_URL}/functions/v1/voice-chat`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ conversationId, audioChunk }),
})

const reader = response.body?.getReader()
const decoder = new TextDecoder()
while (reader) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value, { stream: true })
  // 청크 UI에 append
  appendToUI(chunk)
}
```

### 7.4 Edge Function 리스트 (담당·상태)

| 이름 | 담당 | 상태 | 비고 |
|------|------|------|------|
| `voice-chat` (LLM 스트리밍) | 권오인 | DONE | F-04 / F-05 memories 주입 + 선제 질문 |
| `extract-memory` (세션 종료 후) | 권오인 | DONE | F-04 |
| `tag-utterances` (발화 태그) | 권오인 | DONE | F-05 |
| `generate-book` (월말 pg_cron) | 권오인 | TBD | F-07 |
| `generate-cover` (DALL-E 3) | 권오인 | TBD | F-13 `book-covers` 업로드 |
| `retry-book-job` (수동 재시도) | 권오인 | TBD | F-08, RPC `retry_book_generation`과 연계 |

> 상태: `TBD` (미구현) / `WIP` (구현 중) / `DONE` (완료). 각 Function 상세 스펙은 구현 PR에서 본 절에 추가.

---

### 7.5 `voice-chat` — LLM 스트리밍 응답 + memories 주입 (F-04 / F-05)

| 항목 | 내용 |
|------|------|
| 경로 | `POST /functions/v1/voice-chat` |
| 인증 | `Authorization: Bearer <access_token>` 필수 |
| 응답 형식 | SSE 스트림 (Vercel AI SDK UIMessage 형식) |
| 담당 | 권오인 |

**입력**
```ts
{
  messages: { role: 'user' | 'assistant'; content: string }[]  // 대화 히스토리
  senior_id: string  // 어르신 profile UUID (memories 조회용)
}
```

**동작 — memories 주입 (F-05)**
1. `senior_id` 기준으로 `memories` 테이블 `data.items` 조회 (service_role, RLS 우회)
2. `items`가 있으면 시스템 프롬프트에 `[어르신 관심사 정보]` 섹션 추가
3. `messages.length === 0` (첫 메시지)이면 `[첫 대화 시작 지시]` 섹션 추가 → AI가 관심사 기반 선제 질문 생성
4. `messages.length > 0` (이후 메시지)이면 선제 질문 지시 없음 — 일반 대화 흐름 유지

**폴백 (에러 처리)**
- memories 조회 실패 (DB 에러, PGRST116 등) → 조용히 기본 프롬프트로 폴백 (어르신 UX 방해 없음)
- `items`가 없거나 빈 배열 → 기본 프롬프트 사용

**환경변수 `ACTIVE_MODEL`**
- `'gpt'` → `gpt-4o-mini` 사용
- 기본값(`'gemini'`) → `gemini-2.5-flash` 사용 (개발·테스트 무료 티어)

---

### 7.6 `extract-memory` — 메모리 추출 (F-04)

| 항목 | 내용 |
|------|------|
| 경로 | `POST /functions/v1/extract-memory` |
| 인증 | `Authorization: Bearer <access_token>` 필수 |
| 호출 시점 | 세션 종료 시 fire-and-forget (`keepalive: true` fetch) |
| 담당 | 권오인 |

**입력**
```ts
{
  conversation_id: string  // 종료된 대화 세션 UUID
  senior_id: string        // 어르신 profile UUID
}
```

**출력**
```ts
// 성공 (메모리 갱신)
{ success: true, updated_categories: string[] }

// 성공 (발화 없음 — 건너뜀)
{ success: true, skipped: true }

// 실패 (기존 memories 항상 보존)
{ success: false, error: string }
```

**호출 예시** (useVoiceChat.ts cleanup 내부)
```ts
// keepalive: true — 페이지 이탈 후에도 요청 완료 보장
fetch(`${VITE_SUPABASE_URL}/functions/v1/extract-memory`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'apikey': VITE_SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({ conversation_id, senior_id }),
  keepalive: true,
})
```

**내부 동작**
1. `utterances` 테이블에서 `speaker = 'senior'` 발화만 조회
2. `memories` 테이블에서 기존 `data` JSONB 조회
3. `gpt-4o-mini`로 새 관심사 추출 (카테고리: `hobbies`, `relationships`, `health`, `philosophy`, `recurring_topics`, `emotional_patterns`)
4. 기존 data와 병합 (배열: concat+중복제거 / 객체: 키 단위 merge)
5. `memories` UPSERT (`senior_id` 기준), `conversations.memory_extracted = true`

**에러 처리**
- LLM 실패 또는 JSON 파싱 오류 → 기존 memories 보존, `{ success: false, error }` 반환
- 발화 0건 → `{ success: true, skipped: true }` (DB 변경 없음)

**관련 RPC** (migration `010_memory_rpc.sql`)

| RPC | 인자 | 설명 |
|-----|------|------|
| `remove_memory_item` | `p_senior_id`, `p_category`, `p_item_index?`, `p_item_key?` | 개별 항목 삭제 |
| `clear_all_memories` | `p_senior_id` | 전체 초기화 (`data = '{}'`) |

---

### 7.7 `tag-utterances` — 발화 태그 분류 (F-05)

| 항목 | 내용 |
|------|------|
| 경로 | `POST /functions/v1/tag-utterances` |
| 인증 | `Authorization: Bearer <access_token>` 필수 |
| 호출 시점 | 세션 종료 시 fire-and-forget (`keepalive: true` fetch), `extract-memory`와 독립·동시 호출 |
| 담당 | 권오인 |

**입력**
```ts
{
  conversation_id: string  // 종료된 대화 세션 UUID
  senior_id: string        // 어르신 profile UUID
}
```

**출력**
```ts
// 성공
{ success: true, tagged_count: number }

// 성공 (어르신 발화 없음 — 건너뜀)
{ success: true, skipped: true }

// 실패 (utterances 원본 항상 보존)
{ success: false, error: string }
```

**호출 예시** (useVoiceChat.ts cleanup 내부, extract-memory 바로 아래)
```ts
fetch(`${VITE_SUPABASE_URL}/functions/v1/tag-utterances`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'apikey': VITE_SUPABASE_ANON_KEY,
  },
  body: JSON.stringify({ conversation_id, senior_id }),
  keepalive: true,
}).catch((err) => console.error('[useVoiceChat] tag-utterances 호출 실패', err))
```

**내부 동작**
1. anon 클라이언트로 JWT 검증 + 호출자 uid === senior_id 검증
2. service_role로 conversations.senior_id 소유권 확인
3. `utterances`에서 `speaker = 'senior'`인 발화만 조회 (`sequence_number` 오름차순)
4. `gpt-4o-mini`로 발화별 태그 일괄 분류
5. `utterances.tags` 배열 batch UPDATE (`Promise.allSettled` — 개별 실패 허용)

**태그 종류 (utterance_tag Enum)**

| 태그 | 의미 |
|------|------|
| `daily_mundane` | 일상 잡담 (날씨, 식사, TV 등) |
| `memory_recall` | 과거 추억 회상 (옛날 이야기, 어릴 때) |
| `emotional_peak` | 강한 감정 표현 (기쁨, 슬픔, 그리움) |
| `philosophy` | 삶의 가치관·신념·교훈 |
| `relationship_event` | 가족·지인 관계 사건 |

**에러 처리**
- LLM 실패 / JSON 파싱 오류 → utterances 원본 보존, `{ success: false, error }` 반환
- 개별 utterance UPDATE 실패 → 해당 항목만 console.error, 나머지 계속 진행

---

## 8. 체크리스트 (PR 작성자용)

- [ ] `src/types/database.ts` 재생성 후 커밋
- [ ] RPC·Realtime·Storage·Edge Function 중 하나라도 건드렸다면 본 문서 갱신
- [ ] 새 에러 코드 추가 시 §5 공통 에러 코드 표 업데이트
- [ ] 호출 예시가 [code-convention §8](./code-convention.md) 에러 처리 규약(`{ data, error }` 둘 다 체크)을 따르는지
- [ ] breaking change면 PR 제목에 `[api!]` 접두사, 본문에 상대방 멘션

---

> 본 문서는 구현과 함께 **살아있는 문서**로 갱신됩니다. 실제 구현이 본 명세와 달라지면 **구현을 따르지 말고, 먼저 본 문서를 고쳐 합의한 뒤 구현을 바꿉니다.**
