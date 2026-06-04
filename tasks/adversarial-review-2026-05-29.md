# 적대적 코드 리뷰 결과 (2026-05-29)

두 차례 리뷰 결과를 합산 정리. 중복 항목은 병합, 한쪽에만 있는 항목은 별도 표기.

- **리뷰 A**: Claude 기반 (CRITICAL/HIGH/MEDIUM/LOW)
- **리뷰 B**: Codex CLI GPT-4o 기반 (P1/P2/P3/P4)

---

## 🔴 P1 / CRITICAL — 프로덕션 전 즉시 수정

### 1. JWT 서명 없이 `service_role` 신뢰
- **파일**: `supabase/functions/generate-book/index.ts:775-811`
- `atob()`로 JWT 페이로드 디코딩 후 `payload.role === 'service_role'`로 분기. **서명 검증 없음.**
- 공격자가 위조 JWT로 service_role 실행 경로 진입 가능.
- **수정**: `payload.role` 직접 신뢰 제거. `jose.jwtVerify()` 또는 `auth.getUser()`로 서명 검증 후 분기. 내부 호출은 shared secret으로 보호.
- *리뷰 A + B 공통 발견*

### 2. `SECURITY DEFINER` RPC — 미인증 호출자 우회
- **파일**: `supabase/migrations/011_rpc_trigger_book_generation.sql:16-26`
- `IF auth.uid() IS NOT NULL AND auth.uid() != p_senior_id` 조건이 `auth.uid() IS NULL`(미인증)을 허용 → 타인 계정으로 book generation job 남발 가능.
- **수정**: `IF auth.uid() IS NULL OR auth.uid() != p_senior_id THEN RAISE EXCEPTION` 으로 변경 + `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO authenticated;`
- *리뷰 A 발견*

### 3. 동일 우회 패턴 반복
- **파일**: `supabase/migrations/20260518000002_rpc_trigger_short_book_generation.sql:16-24`
- 위 #2와 동일한 nullable `auth.uid()` 체크 패턴.
- **수정**: #2와 동일한 방식으로 수정.
- *리뷰 A 발견*

---

## 🟠 P2 / HIGH — 조속히 수정

### 4. `SECURITY DEFINER` 네트워크 호출 RPC 호출 범위 미제한 (SSRF류)
- **파일**: `supabase/migrations/20260515000000_rpc_net_http_post_cover.sql:10-46`
- "service_role only" 주석은 있으나 `REVOKE/GRANT EXECUTE` SQL 없음. 호출자 검증 없는 `net.http_post` → DB에서 외부 요청 발사 가능.
- **수정**: `auth.role() = 'service_role'` 체크 추가 + `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO service_role;`
- *리뷰 A + B 공통 발견*

### 5. 알림 INSERT 정책 — 임의 recipient에 알림 삽입 가능
- **파일**: `supabase/migrations/20260518000001_notifications_rls_fix.sql:19-21`
- INSERT 정책이 `auth.uid() IS NOT NULL`만 체크, `recipient_id` 소유권 미검증. 인증된 사용자라면 누구에게든 알림 스팸 가능.
- **수정**: `recipient_id = auth.uid()` 또는 family 관계 기반 조건 추가.
- *리뷰 A + B 공통 발견*

### 6. `chapter-photos` public 버킷 — 경로 소유권 미검증
- **파일**: `supabase/migrations/20260520000001_chapter_photos.sql:6-14`
- 인증된 사용자라면 임의 경로에 업로드 가능. public 버킷이라 콘텐츠 오염 + 무제한 스토리지 남용 위험.
- **수정**: 경로 소유권 정책 `(storage.foldername(name))[1] = auth.uid()::text` 추가. MIME 타입 및 파일 크기 제한.
- *리뷰 A + B 공통 발견*

### 7. `reply-audio` 버킷 — 모든 인증 사용자 읽기 가능
- **파일**: `supabase/migrations/20260518000002_reply_audio_storage_policy.sql:6-8`
- 모든 인증 사용자가 `reply-audio` 전체 오브젝트 SELECT 가능 → 메타데이터/경로 열거 및 타인 음성 파일 접근.
- **수정**: 소유자 또는 가족 관계 기반 SELECT 정책으로 교체.
- *리뷰 B 발견*

### 8. 반응 이모지 UI/DB 불일치 — 확정적 insert 실패
- **파일**: `frontend/src/features/senior/pages/SeniorBookReadPage.tsx:375` + `supabase/migrations/20260520000002_comment_reactions.sql:6`
- UI는 `😂`, `🙏` 전송하나 DB CHECK 제약은 `❤️`, `👍`, `😢`만 허용 → insert 실패 + 낙관적 업데이트 desync.
- **수정**: DB CHECK 제약을 UI 이모지 목록과 일치시키거나, UI 이모지 목록을 DB 허용 값으로 맞춤.
- *리뷰 B 발견*

### 9. book 생성 멀티 스텝 write 비원자적
- **파일**: `supabase/functions/generate-book/index.ts:399-460`
- `books`, `chapters`, job 업데이트, utterance lock이 트랜잭션으로 묶이지 않음 → 부분 실패 시 상태 불일치.
- **수정**: DB 트랜잭션 또는 RPC 함수로 묶어 원자적 처리.
- *리뷰 B 발견*

### 10. `replies` RLS — 존재하지 않는 `comments.book_id` 참조
- **파일**: `supabase/migrations/20260518000005_replies_rls_fix.sql:17`
- RLS 정책이 `comments.book_id`에 JOIN하지만 실제 스키마엔 `comments.chapter_id`만 존재 → 마이그레이션 적용 실패, RLS 불일치 상태 배포 위험.
- **수정**: `comments.chapter_id → chapters.book_id` 경유 JOIN으로 재작성.
- *리뷰 A 발견*

---

## 🟡 P3 / MEDIUM

### 11. 표지 재생성 폴링 오동작
- **파일**: `frontend/src/features/bookshelf/hooks/useBookEdit.ts:301-321`
- row count 방식으로 완료 감지 → 재생성 시 row count 불변이라 완료 감지 실패, 거짓 타임아웃 발생.
- **수정**: `updated_at` 또는 `image_url` 변경 감지 방식으로 교체.
- *리뷰 A 발견*

### 12. 반응(이모지) 낙관적 업데이트 에러 미처리
- **파일**: `frontend/src/features/senior/pages/SeniorBookReadPage.tsx:347-387`
- Supabase insert/delete 에러 무시 → UI와 DB 상태 불일치.
- **수정**: `{ error }` 체크 후 실패 시 optimistic update 롤백.
- *리뷰 A 발견*

### 13. 사진 삭제 storage/DB 에러 무시
- **파일**: `frontend/src/features/senior/pages/BookEditPage.tsx:257-258`
- storage 삭제와 DB 삭제 중 하나 실패해도 성공 toast → orphaned file 또는 stale URL 발생.
- **수정**: 두 작업 모두 `{ error }` 확인 후 순서대로 처리, 실패 시 에러 toast.
- *리뷰 A 발견*

### 14. short-book 트리거 RPC — 중복 pending job 방지 없음
- **파일**: `supabase/migrations/20260518000002_rpc_trigger_short_book_generation.sql:31-33`
- 중복 체크/lock 없이 insert → 동일 topic/utterance에 대해 중복 pending job 생성 가능.
- *리뷰 B 발견*

### 15. `useVoiceReply` — 언마운트 시 interval/recognition 정리 없음
- **파일**: `frontend/src/features/senior/hooks/useVoiceReply.ts:31-49`
- 컴포넌트 언마운트 시 interval과 speech recognition 정리 cleanup 없음 → 리소스 누수.
- **수정**: `useEffect` cleanup에서 interval clearInterval + recognition.abort() 처리.
- *리뷰 B 발견*

### 16. `useVoiceChat` — `onend`에서 `setState` 직접 사용으로 `stateRef` diverge
- **파일**: `frontend/src/features/chat/hooks/useVoiceChat.ts:121-470`
- `onend` 핸들러에서 `updateState` 대신 `setState` 직접 사용 → `stateRef`와 React state 불일치 → `startListening`/`stopListening` 게이트 로직 오동작.
- **수정**: `onend` 내부에서 `updateState` 사용으로 통일.
- *리뷰 B 발견*

---

## ⚪ P4 / LOW

### 17. 알림 낙관적 업데이트 rollback 없음
- **파일**: `frontend/src/features/notifications/hooks/useNotifications.ts:39-87`
- `markAsRead`, `markAllRead`, `deleteNotification`이 store 먼저 변경 후 DB 에러 무시 → 클라이언트/서버 상태 영구 불일치.
- **수정**: DB 작업 실패 시 store 상태 원복(rollback).
- *리뷰 B 발견*

### 18. `setTimeout` 언마운트 시 미정리
- **파일**: `frontend/src/features/senior/pages/SeniorBookReadPage.tsx:303`
- cleanup 없는 `setTimeout` → 언마운트 후 상태 업데이트 시도 가능.
- **수정**: `useEffect` cleanup에서 `clearTimeout` 처리.
- *리뷰 B 발견*

### 19. `SECURITY DEFINER` 함수 `search_path` 미고정
- **파일**: `supabase/migrations/004_triggers.sql:37-54`
- `public.handle_new_user()` search_path 미고정 → 권한 구성에 따라 객체 이름 하이재킹 위험.
- **수정**: 함수 정의에 `SET search_path = public, pg_catalog` 추가.
- *리뷰 A 발견*

---

## 수정 우선순위 요약

| 순위 | 항목 | 위험도 |
|------|------|--------|
| 1 | JWT 서명 없이 service_role 신뢰 (#1) | 권한 상승 |
| 2 | SECURITY DEFINER RPC 미인증 우회 (#2, #3) | 권한 우회 |
| 3 | net_http_post_cover 호출 범위 미제한 (#4) | SSRF |
| 4 | 반응 이모지 UI/DB 불일치 (#8) | 확정적 기능 오류 |
| 5 | 알림 recipient 미검증 (#5) | 데이터 오염 |
| 6 | reply-audio 접근 제어 (#7) | 개인정보 |
| 7 | book 생성 비원자적 write (#9) | 데이터 정합성 |
| 8 | replies RLS book_id 참조 오류 (#10) | 마이그레이션 실패 |
