# 보안 이슈 수정 기록 (fix/security-audit)

적대적 리뷰(`adversarial-review-2026-05-29.md`) 항목을 P1부터 순차 수정한 기록.
문제 재발 시 참조용. 각 항목: 무엇을 / 어떻게 / 검증 방법.

---

## ✅ P1-1: generate-book JWT 서명 검증 (CRITICAL)

- **파일**: `supabase/functions/generate-book/index.ts:775~`, 신규 `auth.ts` + `auth.test.ts`
- **문제**: Bearer JWT의 payload를 `atob()`로 디코딩해 `payload.role === 'service_role'`이면 서명 검증 없이 통과시켜, 공격자가 `{"role":"service_role"}` 위조 토큰으로 RLS 우회 경로에 진입 가능(권한 상승).
- **해결**: role 클레임 신뢰를 제거. service_role 호출자는 항상 동일한 키(`SUPABASE_SERVICE_ROLE_KEY`)를 Bearer로 보내므로, 토큰이 실제 키와 **정확히 일치**(상수 시간 비교 `timingSafeEqual`)할 때만 내부 호출로 인정. 그 외 모든 토큰은 기존대로 `auth.getUser()`로 서명까지 검증 → 위조 토큰은 401.
- **검증**: `deno test supabase/functions/generate-book/auth.test.ts` 7개 통과(위조 JWT 거부·실제 키 일치·빈 키 거부 등). `deno check`로 기존 대비 신규 타입 에러 0(38→36개로 오히려 감소).
- **기능 보존**: pg_cron(실제 키)=통과, 프론트(사용자 토큰)=auth.getUser() 통과, 공격자(위조)=401.

> 인접 관찰(IDOR): `job_id` 처리 경로에서 인증된 사용자가 **타인의 pending job_id**를 넘겨도 소유권을 재검증하지 않음. → **✅ 해결됨**(아래 "추가: generate-book job_id IDOR 차단" 참조, 2026-06-01 배포 완료).

---

## ✅ P1-2: trigger_book_generation 미인증 우회 차단 (CRITICAL)

- **파일**: 신규 `supabase/migrations/20260529000001_fix_trigger_book_generation_auth.sql`
- **문제**: 권한 검증이 `auth.uid() IS NOT NULL AND auth.uid() != p_senior_id` 라, `auth.uid()`가 NULL인 미인증(anon)이 통과됨. 게다가 함수 EXECUTE 권한이 PUBLIC/anon에 부여돼 있어(원격 ACL `=X` + `anon=X` 확인), 익명 호출자가 임의 senior로 book_generation_jobs를 무제한 생성 가능(SECURITY DEFINER → RLS 우회).
- **해결**: 조건을 `auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() != p_senior_id)`로 강화(service_role은 auth.role로 구분 허용, anon 차단). + `REVOKE EXECUTE FROM PUBLIC, anon` / `GRANT EXECUTE TO authenticated`. 함수 본문(stage_payload 기준 중복 방지)은 원격 DB 현재 정의를 그대로 보존.
- **검증**: 프로덕션 함수를 건드리지 않고, 동일 가드 로직의 임시 함수(`_sectest_*`)에 JWT 클레임 GUC로 4역할 시뮬레이션 → service_role=ALLOWED, 본인=ALLOWED, 타사용자=BLOCKED, **anon=BLOCKED**. 검증 후 임시 함수 DROP.
- **주의**: 마이그레이션은 **미적용**(파일만 생성). 사용자가 테스트 시 적용 예정. 적용 명령 예: `supabase db push` 또는 MCP `apply_migration`.
- **기능 보존**: 프론트(MyBooksPage)는 본인 토큰으로 호출 → ALLOWED. pg_cron은 이 RPC를 호출하지 않고 generate-book Edge Function을 직접 호출하므로 영향 없음.

---

## ✅ P1-3: trigger_short_book_generation 동일 우회 차단 (CRITICAL)

- **파일**: 신규 `supabase/migrations/20260529000002_fix_trigger_short_book_generation_auth.sql`
- **문제**: P1-2와 완전히 동일한 패턴(anon 우회 + PUBLIC/anon EXECUTE). 단편 책 job 생성 RPC.
- **해결**: P1-2와 동일한 권한 가드(`auth.role() <> 'service_role' AND (auth.uid() IS NULL OR auth.uid() != p_senior_id)`) + `REVOKE EXECUTE FROM PUBLIC, anon` / `GRANT TO authenticated`. 본문(utterance_ids 검증, job insert)은 원격 정의 그대로 보존.
- **검증**: 권한 가드 조건이 P1-2와 바이트 단위로 동일 → P1-2의 임시 함수 4역할 시뮬레이션 결과(anon=BLOCKED 등)가 그대로 적용. 호출자는 프론트 MyBooksPage(본인 토큰)뿐임을 grep으로 확인.
- **주의**: 마이그레이션 **미적용**(파일만). 사용자 테스트 시 적용.
- **참고**: 이 함수의 중복 pending job 방지 부재는 별도 항목 **P3-#14**로 분리(여기선 손대지 않음).

---

## ✅ P2-4: net_http_post_cover 호출 범위 제한 — SSRF 차단 (HIGH)

- **파일**: 신규 `supabase/migrations/20260529000003_restrict_net_http_post_cover.sql`
- **문제**: SECURITY DEFINER 로 임의 URL POST(`net.http_post`)를 래핑하는데 EXECUTE 권한이 PUBLIC/anon/authenticated 까지 부여됨 → 익명/일반 사용자가 DB 서버로 임의 URL HTTP 요청 발사 가능(SSRF). 원격에 **오버로드 3개**(2개 SECURITY DEFINER) 누적, 셋 다 노출.
- **해결**: 3개 시그니처 [(text,uuid,uuid,uuid,text), (text×6), (text,uuid,uuid,uuid,text,text)] 모두 `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` + `GRANT TO service_role`. Edge Function은 service_role 클라이언트로 호출하므로 정상 동작.
- **검증**: 트랜잭션 내 REVOKE/GRANT 적용 → 3개 모두 ACL `{postgres=X, service_role=X}`(PUBLIC/anon/authenticated 제거) 확인 → ROLLBACK. 롤백 후 프로덕션은 여전히 anon 노출 3건 확인(마이그레이션 미적용 상태).
- **주의**: 마이그레이션 **미적용**(파일만). 사용자 테스트 시 적용.
- **메모**: 동일 이름 오버로드 3개 공존은 PostgREST 호출 모호성 유발 가능성(별도 정리 권장 — 이번 범위 밖).

---

## ✅ P2-5: notifications INSERT recipient 검증 — 해결 (HIGH) [결정: SECURITY DEFINER 헬퍼]

- **파일**: `supabase/migrations/20260518000001_notifications_rls_fix.sql` (정책 `notifications_insert_authenticated`)
- **문제 확정**: INSERT 정책 `WITH CHECK (auth.uid() IS NOT NULL)` → 인증 사용자가 임의 recipient에 알림 삽입(스팸) 가능.
- **보류 사유**: 알림 흐름 분석 결과 **가족 A → 가족 B**(같은 senior의 책에 댓글/답글) 알림이 존재. 단순 `recipient=auth.uid()`나 senior↔family 양방향 체크로는 이 정상 케이스가 깨짐. "같은 가족 서클 공유" 판정이 필요하며 구현 방식 선택이 필요함.
- **알림 생성 지점**(프론트, 모두 SeniorBookReadPage.tsx): 459(가족→저자), 471-472(저자→가족 전체), 536-537·582-583(답글→댓글작성자).
- **검토한 선택지**:
  - A. RLS 인라인 체크(senior↔family 양방향만) — 단순하나 가족↔가족 알림 깨짐 ❌
  - B. `SECURITY DEFINER` 헬퍼 `shares_family_circle(a,b)`로 서클 공동소속 판정 후 WITH CHECK 사용 — 모든 케이스 커버, 프론트 무수정. 미세한 관계 probing 표면 추가.
  - C. 알림 생성 자체를 `SECURITY DEFINER` RPC로 이전 + 직접 INSERT 차단 — 가장 견고하나 프론트 4곳 수정 필요.
- **권장**: B (기능 보존 + 프론트 무수정 + 스팸 차단). 사용자 결정 후 진행.
- **family_links 참고**: 컬럼 senior_id/family_id, enum invite_status에 'accepted' 존재. RLS `own_family_links`: `senior_id=auth.uid() OR family_id=auth.uid()`.
- **✅ 해결(결정 B)**: 신규 `supabase/migrations/20260529000006_notifications_insert_family_circle.sql`. `shares_family_circle(a,b)` SECURITY DEFINER·STABLE·search_path 고정 헬퍼 도입(두 사용자가 같은 senior의 accepted 서클에 공동 소속인지 판정, family_links RLS 우회). INSERT 정책을 `recipient=본인 OR shares_family_circle(auth.uid(), recipient_id)`로 교체. 헬퍼는 PUBLIC/anon REVOKE, authenticated GRANT.
- **검증**: EXISTS 로직을 VALUES 시뮬레이션으로 6케이스 테스트 — senior→가족=T, 가족→senior=T, 가족↔가족(동일서클)=T, 가족↔타senior가족=F, senior↔무관senior=F, pending제외=F. 전부 expected 일치. 실제 알림 흐름(가족↔가족 답글 포함) 보존 + 스팸 차단 확인.
- **주의**: 마이그레이션 **미적용**(파일만). is_family_of와 동일 패턴(SECURITY DEFINER, public 스키마) — 기존 코드베이스 관례 따름.

---

## ✅ P2-6: chapter-photos 버킷 경로 소유권 제한 (HIGH)

- **파일**: 신규 `supabase/migrations/20260529000004_chapter_photos_path_ownership.sql`
- **문제(실제 더 심각)**: 마이그레이션 파일엔 INSERT/DELETE 분리 정책이 있으나, **원격 DB 실제 상태는 `chapter_photos_all` (FOR ALL, authenticated, 경로체크 없음)** 였음 → 인증 사용자가 타인 사진까지 읽기/수정/삭제 가능. (대시보드/MCP로 정책이 ALL로 바뀐 채 방치된 것으로 추정)
- **해결**: `chapter_photos_all` 등 기존 정책 DROP 후, 경로 규칙 `{uid}/{chapterId}.{ext}`(BookEditPage.tsx) 기준으로 4개 정책 재구성 — SELECT(public 읽기), INSERT/UPDATE/DELETE(본인 uid 폴더만). upsert:true 업로드 위해 SELECT+INSERT+UPDATE 모두 확보. 버킷에 이미지 MIME 화이트리스트 + 15MB 상한 추가.
- **검증**: (1) `storage.foldername` 경로 로직 — 본인=true, 타인=false 확인. (2) 트랜잭션 내 정책 재구성 → SELECT/INSERT/UPDATE/DELETE 4개·소유권 조건 확인 → ROLLBACK(프로덕션 무변경).
- **주의**: 마이그레이션 **미적용**(파일만). 사용자 테스트 시 적용. MIME 화이트리스트로 인해 향후 비이미지 업로드는 거부됨(의도된 동작).
- **기능 보존**: 사진 업로드/덮어쓰기/삭제 모두 본인 책 편집자(senior=uid=경로)라 정상. 공개 URL 표시는 SELECT public으로 유지.

---

## ✅ P2-7: reply-audio 읽기 권한 제한 — 해결 (HIGH) [결정: SECURITY DEFINER 헬퍼]

- **파일**: `supabase/migrations/20260518000002_reply_audio_storage_policy.sql` (정책 `reply_audio_read`, `reply_audio_select_authenticated` — **중복** 2개)
- **문제 확정**: SELECT 정책이 `bucket_id='reply-audio'`뿐(모든 authenticated 전체 읽기) → 아무 인증 사용자가 타인 음성에 대한 서명 URL 생성 가능(`createSignedUrl` 직접 호출, useVoiceReply.ts:114-120).
- **보류 사유**:
  1. **듣는 사람 ≠ 올린 사람** — 가족이 senior의 답장 음성을 들어야 함. 경로 소유권으로 막으면 재생이 깨짐(요구사항 #1 위배).
  2. 올바른 범위 = "책의 가족 서클 참여자" → **P2-5와 동일한 가족 서클 인증 모델에 결합**.
  3. 경로 구조 불일치: 답장 `{seniorId}/{replyId}.webm`(useVoiceReply.ts:95) vs 댓글 음성 `comments/{uid}/{commentId}.webm`(SeniorBookReadPage.tsx:439) → 경로만으로 책/서클 도출 불가.
  4. CLAUDE.md 명세의 `create_signed_reply_audio_url` RPC는 **원격 DB에 미구현**(현재 클라이언트 직접 createSignedUrl).
- **권장**: CLAUDE.md 설계대로 `create_signed_reply_audio_url`를 SECURITY DEFINER RPC로 **구현**(reply/comment→book→참여자 검증 후 서명 URL 반환) + storage SELECT를 service_role 한정으로 잠금 + 프론트가 RPC 사용하도록 변경. 또는 P2-5의 `shares_family_circle` 헬퍼 기반 SELECT 정책. **P2-5 결정과 함께 처리 권장.**
- **즉시 가능한 부수 정리**: 중복 SELECT 정책 1개 제거(보안 효과는 없으나 위생). 본 수정에 포함 예정.
- **✅ 해결(결정: SECURITY DEFINER 헬퍼)**: 신규 `supabase/migrations/20260529000007_reply_audio_scoped_read.sql`. 서명 URL은 Postgres에서 생성 불가하므로 클라이언트 createSignedUrl 흐름 유지하되 SELECT 정책을 객체별 접근권으로 좁힘. `can_access_reply_audio(name)` SECURITY DEFINER 헬퍼: 경로(`comments/{uid}/{commentId}.webm` 또는 `{seniorId}/{replyId}.webm`)에서 ID 추출 → reply/comment→book 역추적 → `senior 본인 OR shares_family_circle` 판정(fail-closed). 중복 SELECT 정책 2개 제거 후 범위 제한 정책으로 교체.
- **검증**: (1) 경로→UUID 추출 두 형식 정확. (2) 트랜잭션 내 헬퍼 생성 후 — 비인증=false, 미존재 comment/reply=false, 잘못된 UUID=false (전부 fail-closed). (3) 실제 comment를 그 책 저자(senior)로 접근 → true. 프론트 수정 불필요.
- **주의**: 마이그레이션 **미적용**(파일만). shares_family_circle(20260529000006) 의존 → 적용 순서상 이후 번호라 OK.

---

## ✅ P2-8: 반응 이모지 UI/DB 불일치 (HIGH)

- **파일**: 신규 `supabase/migrations/20260529000005_comment_reactions_emoji_align.sql`
- **문제 확정**: UI는 댓글·답글 공통 `REACTION_EMOJIS=['❤️','👍','😂','😢','🙏']`(5종, SeniorBookReadPage.tsx:17) 사용. 그러나 `comment_reactions.emoji` CHECK는 `❤️👍😢`(3종)만 허용 → 댓글에 😂/🙏 누르면 insert 실패 + 낙관적 UI desync. (`reply_reactions`는 이미 5종 허용 → 답글은 정상)
- **해결**: `comment_reactions_emoji_check`를 `reply_reactions`와 동일한 5종으로 확장(additive, 기존 데이터 무영향). UI/두 테이블 정합.
- **검증**: TEMP 테이블에 새 CHECK 적용 → 5종(😂🙏 포함) 전부 삽입 성공(`accepted_count=5`) 확인. session-local이라 자동 정리.
- **주의**: 마이그레이션 **미적용**(파일만). 사용자 테스트 시 적용.
- **참고**: 반응 낙관적 업데이트 에러 미처리(`SeniorBookReadPage.tsx:347-387`)는 별도 항목(P3 영역)으로 분리 — 여기선 정합만 처리.

---

## ✅ P2-9: book 생성 멀티스텝 원자성 — 타깃 보강 (HIGH) [결정: B]

- **파일**: `supabase/functions/generate-book/index.ts:399-466`
- **현황 재평가**: 이미 부분 보상 로직 존재 — chapters INSERT 실패 시 고아 book 삭제(L443, 가장 치명적인 unique 제약 잠김 케이스 해소), utterance 잠금 실패는 의도적 비치명 처리(L468). 남은 갭: `chapter_count` 업데이트(L451)·job status 업데이트(L457) 실패 시 에러 미확인 → chapter_count=0 또는 job에 book_id 누락(경미, 데이터 손상 아님, 일부 재시도 시 stuck 가능).
- **보류 사유**: 완전 원자성은 books+chapters+count를 단일 plpgsql RPC 트랜잭션으로 묶는 리팩터가 정석이나, (1) 핵심 생성 파이프라인 변경이라 회귀 위험, (2) 검증에 실제 파이프라인 실행(OpenAI 키·실데이터) 필요 — 요구사항 #2(검증 필수) 충족이 어려움.
- **검토 선택지**:
  - A. `create_book_with_chapters(...)` SECURITY DEFINER RPC로 books+chapters+chapter_count를 단일 트랜잭션 처리(엘레강트, 회귀 위험·E2E 테스트 필요). 커버 호출/job status는 외부 유지.
  - B. 타깃 보강만 — chapter_count/job-status 단계에 에러 체크 + 실패 시 보상 처리 추가(최소 변경, 저위험).
- **권장**: B(저위험)로 즉시 갭 보강 후, A(완전 원자성)는 파이프라인 테스트 가능 시점에 별도 진행. 사용자 결정 대기.
- **✅ 해결(결정 B)**: `supabase/functions/generate-book/index.ts` 수정. 분석 결과 유일한 silent failure는 `chapter_count` 업데이트 에러 미확인(월간 L451·단편 L707 두 곳)이었음(나머지: 고아 book 삭제·utterance 잠금·job status는 이미 처리/로깅됨). 두 곳에 에러 체크 + 비치명 경고 로그 추가(기존 utterance-lock 경고 패턴과 동일). chapter_count는 표시용 카운터라 실패해도 책·챕터는 정상.
- **검증**: `deno check` 에러 36개(P1-1 이후 동일, 기존 SupabaseClient 제네릭 이슈) — `countErr` 관련 신규 에러 0. 기능 회귀 없음.
- **잔여(선택)**: 완전 원자성(A, books+chapters+count 단일 RPC 트랜잭션)은 파이프라인 E2E 테스트 가능 시점에 별도 진행 권장. 현재 B로 silent failure는 제거됨.
- **주의**: Edge Function 변경 → 적용하려면 `supabase functions deploy generate-book` 필요.

---

## ✅ P2-10: replies RLS comments.book_id 참조 — 오탐(수정 불필요) (HIGH)

- **파일**: `supabase/migrations/20260518000005_replies_rls_fix.sql`
- **검증 결과**: **오탐(false positive)**. 리뷰는 "comments에 book_id 없고 chapter_id만 존재"라 했으나, 실제 `comments` 컬럼은 `id, author_id, content, created_at, updated_at, book_id, audio_url` — **book_id 존재**. `comments_book_id_migration`(20260515074500)으로 chapter_id→book_id 전환 완료됨.
- **현행 정책 정상**: `replies_select_accessible`가 `comments cm JOIN books b ON cm.book_id=b.id`로 올바르게 동작. 원격 정책 = 마이그레이션 파일과 일치.
- **결론**: 변경 없음. 리뷰가 stale 마이그레이션 파일 기준으로 분석해 발생한 오탐.

---

## P2 라운드 요약

| 항목 | 상태 |
|------|------|
| P2-4 net_http_post_cover SSRF | ✅ 수정(마이그레이션, 배포됨) |
| P2-5 notifications INSERT | ✅ 해결(가족서클 헬퍼, 배포됨) [결정완료] |
| P2-6 chapter-photos 경로 소유권 | ✅ 수정(마이그레이션, 배포됨) |
| P2-7 reply-audio 읽기 | ✅ 해결(가족서클 헬퍼, 배포됨) [결정완료] |
| P2-8 반응 이모지 정합 | ✅ 수정(마이그레이션, 배포됨) |
| P2-9 book 생성 원자성 | ✅ 타깃 보강 B(배포됨) [결정완료] |
| P2-10 replies RLS book_id | ✅ 오탐(수정 불필요) |

**수정 6 · 오탐 1 · 결정 대기 0** — P2 7건 전부 처리·배포 완료.

> **결정 반영 완료**: P2-5=SECURITY DEFINER 헬퍼, P2-7=SECURITY DEFINER 헬퍼, P2-9=타깃 보강 B. 셋 다 사용자 결정 후 ✅ 구현·배포 완료(2026-06-01 프로덕션 적용). 더 이상 결정 대기 항목 없음.

---

# P3 (MEDIUM)

## ✅ P3-11: 표지 재생성 폴링 오동작 — 비발현(dead code 제거) (MEDIUM)

- **파일**: `frontend/src/features/bookshelf/hooks/useBookEdit.ts` (regenerateCover)
- **검증 결과**: 사용자 체감상 **이미 정상 동작**. generate-cover의 `single` 모드는 항상 동기 200 반환(L573-579 `await generateAndUploadCover` 후 200). regenerateCover/retryCover 모두 single 모드만 사용 → 202를 받지 않음. 재생성은 200 분기에서 `?t=timestamp` 캐시버스팅으로 처리됨(같은 storage 경로 덮어쓰기라 URL 불변 → 캐시버스팅이 정답).
- **근본 원인**: L301-329의 202 count 기반 폴링 블록은 (1) single 모드가 202를 안 줘서 **도달 불가**, (2) 재생성은 row 수·image_url이 안 변해 count 폴링으로 완료 감지 **불가능** — 즉 도달 불가 + 부정확한 dead code.
- **조치**: 해당 dead 블록 제거(설명 주석으로 대체). 폴링 ref들은 **최초 표지 생성** 폴링(L122-175, 챕터별 row 점진 삽입 → count 폴링이 올바름)에서 계속 사용되므로 제거 안전.
- **검증**: `tsc -b` exit 0(타입 에러 0). ESLint 신규 에러 0(L56/L87 setState-in-effect는 기존 무관 이슈). cover_images 스키마 확인(updated_at 없음, 경로 `{seniorId}/{bookId}/{chapterId}.png` upsert).

---

## ✅ P3-12: 반응 낙관적 업데이트 에러 미처리 (MEDIUM)

- **파일**: `frontend/src/features/senior/pages/SeniorBookReadPage.tsx` (handleToggleReaction, handleToggleReplyReaction)
- **문제**: comment/reply reaction의 insert/delete 결과 `error`를 확인하지 않고 무조건 로컬 상태 갱신 → DB 실패(CHECK 위반·네트워크·RLS) 시 UI엔 반영됐으나 DB엔 없음 → 재로드 시 desync.
- **해결**: delete/insert를 삼항으로 묶어 `{ error }` 수신, 에러 시 `showToast('반응을 반영하지 못했어요')` 후 return(로컬 상태 미변경). 성공 시에만 setReactions/setReplyReactions.
- **검증**: `tsc -b` 통과. ESLint 신규 에러 0(보고된 L155/247/296/297은 기존 무관 이슈).

---

## ✅ P3-13: 사진 삭제 storage/DB 에러 미처리 (MEDIUM)

- **파일**: `frontend/src/features/senior/pages/BookEditPage.tsx` (handlePhotoDelete)
- **문제**: try/catch로 감쌌으나 Supabase 호출은 에러 시 throw하지 않고 `{ error }` 반환 → storage remove/DB update 실패가 catch 안 됨 → 실패해도 성공 toast(orphan 파일 또는 stale URL).
- **해결**: 순서를 **DB update 먼저 → storage remove 나중**으로 변경하고 각 단계 `{ error }` 확인. DB 실패 시 중단(일관 상태 유지). storage 실패는 비치명(고아 파일만, 경고 로그) — DB 참조는 이미 제거돼 사용자 의도(책에서 사진 제거) 충족. 성공 시에만 UI 갱신 + 성공 toast.
- **검증**: `tsc -b` 통과(에러 0).

---

## ✅ P3-14: short-book 중복 pending job 방지 (MEDIUM)

- **파일**: `supabase/migrations/20260529000002_fix_trigger_short_book_generation_auth.sql` (P1-3 파일에 통합 — 동일 함수 이중 재정의 방지)
- **문제**: `trigger_short_book_generation`에 중복 체크 없이 INSERT → 이중 클릭·재시도로 동일 주제 pending job 중복 생성.
- **해결**: INSERT 전에 같은 senior + 진행중 상태(pending/aggregating/chaptering/cover_requested) + book_type='short' + 동일 topic_title인 job을 조회해 있으면 그 job_id 반환. 'done'/'failed'는 제외 → 완료/실패 후 같은 주제 재생성은 허용.
- **검증**: (1) 중복방지 SELECT를 VALUES 시뮬레이션으로 검증 — 진행중 동일주제=기존반환(j1/j5), 신규주제=null, done/monthly/타senior 제외. (2) 전체 마이그레이션 트랜잭션 적용 → has_dedup=true·anon 권한 회수 확인 → ROLLBACK.
- **주의**: P1-3과 같은 파일. 마이그레이션 미적용(파일만).

---

## ✅ P3-15: useVoiceReply 언마운트 정리 (MEDIUM)

- **파일**: `frontend/src/features/senior/hooks/useVoiceReply.ts`
- **문제**: 녹음 도중 컴포넌트 언마운트 시 stopRecording을 거치지 않아 interval 타이머·SpeechRecognition·마이크 스트림(MediaRecorder)이 정리되지 않음 → 리소스 누수(마이크 표시등 유지 등).
- **해결**: 마운트당 1회 `useEffect` 등록, 언마운트 cleanup에서 timerRef clearInterval + recognitionRef.stop() + mediaRecorder 스트림 트랙 stop(마이크 해제). `useEffect` import 추가.
- **검증**: `tsc -b` 통과. ESLint 에러/경고 0.

---

## ✅ P3-16: useVoiceChat onend setState diverge (MEDIUM)

- **파일**: `frontend/src/features/chat/hooks/useVoiceChat.ts:470`
- **문제**: `recognition.onend`가 `setState((prev)=>prev==='listening'?'idle':prev)` 직접 호출 → `stateRef.current` 미갱신. listening→idle 전환 후에도 stateRef가 'listening'으로 남아, stateRef를 참조하는 게이트 로직(no-speech 재시작 L461, L558/583/642 등)이 오동작 가능.
- **해결**: `if (stateRef.current === 'listening') updateState('idle')`로 교체. updateState가 stateRef+React state를 함께 갱신하므로 동기화 유지. 조건부 전환 동작 보존(stateRef는 updateState로만 갱신돼 항상 최신).
- **검증**: `tsc -b` 통과. 기존 `useVoiceChat.test.ts` **16개 전부 통과**(회귀 없음).

---

## P3 라운드 요약

| 항목 | 상태 |
|------|------|
| P3-11 표지 재생성 폴링 | ✅ dead code 제거(비발현 이슈) |
| P3-12 반응 낙관적 업데이트 | ✅ 에러 시 롤백/토스트 |
| P3-13 사진 삭제 에러 | ✅ DB먼저+에러체크 |
| P3-14 short-book 중복 job | ✅ 진행중 동일주제 dedup |
| P3-15 useVoiceReply 정리 | ✅ 언마운트 cleanup |
| P3-16 useVoiceChat stateRef | ✅ updateState 동기화 |

**6건 전부 수정 완료.** 프론트 변경은 tsc/eslint/기존 테스트로 검증.

---

# P4 (LOW)

## ✅ P4-17: 알림 낙관적 업데이트 rollback (LOW)

- **파일**: `frontend/src/features/notifications/hooks/useNotifications.ts` (markAsRead, markAllRead, deleteNotification)
- **문제**: store를 먼저 변경(낙관적)하고 DB 결과 `error`를 무시 → DB 실패 시 store/DB 영구 불일치.
- **해결**: 각 함수에서 `useNotificationsStore.getState().notifications`로 변경 전 스냅샷 확보 → 낙관적 변경 → DB 호출 `{ error }` 확인 → 실패 시 `setNotifications(snapshot)`으로 롤백.
- **검증**: `tsc -b` 통과. React Compiler "memoization could not be preserved" 경고는 원본 4건 = 수정본 4건(이 파일 async useCallback의 기존 노이즈, 증가 없음).

---

## ✅ P4-18: setTimeout 언마운트 미정리 (LOW)

- **파일**: `frontend/src/features/senior/pages/SeniorBookReadPage.tsx` (showToast)
- **문제**: `showToast`의 `setTimeout(()=>setToastMsg(null),2500)`이 추적/정리되지 않음 → 언마운트 후 setState, 연속 토스트 시 이전 타이머가 새 토스트를 조기 제거.
- **해결**: `toastTimerRef`로 타이머 추적, showToast에서 직전 타이머 clearTimeout 후 재설정, 언마운트 cleanup useEffect에서 clearTimeout. (바로 위 기존 useEffect와 동일 위치라 hook 순서 안전)
- **검증**: `tsc -b` 통과. rules-of-hooks 위반 없음.

---

## ✅ P4-19: handle_new_user search_path 고정 (LOW)

- **파일**: 신규 `supabase/migrations/20260529000008_handle_new_user_search_path.sql`
- **검증 결과**: 라이브 DB의 `handle_new_user`는 **이미 `SET search_path = public` 적용됨**(proconfig 확인) — 리뷰는 stale한 004_triggers.sql 기준. 다만 어떤 마이그레이션 파일에도 이 설정이 없어 신규 환경 재빌드 시 누락(재현성 결함).
- **해결**: `ALTER FUNCTION public.handle_new_user() SET search_path = public;` 마이그레이션 추가(본문 미변경, 라이브엔 멱등). 마이그레이션 히스토리를 보안 상태와 일치시켜 재현성 확보.
- **검증**: 트랜잭션 내 ALTER 적용 → proconfig `["search_path=public"]` 확인 → ROLLBACK.
- **주의**: 마이그레이션 미적용(파일만). 라이브 DB엔 이미 적용돼 있으므로 적용해도 무변경.

---

# 전체 라운드 요약 (P1~P4)

| 라운드 | 수정 | 오탐/비발현 | 합계 |
|--------|------|-------------|------|
| P1 (CRITICAL) | 3 | 0 | 3 |
| P2 (HIGH) | 6 | 1 (P2-10) | 7 |
| P3 (MEDIUM) | 5 + 1(P3-11 dead code) | — | 6 |
| P4 (LOW) | 2 + 1(P4-19 재현성) | — | 3 |
| **합계** | **19개 처리** | | **19** |

## 적용 필요 산출물 (커밋·테스트 시)

**SQL 마이그레이션 (미적용, 파일만):**
- `20260529000001` trigger_book_generation 인증 (P1-2)
- `20260529000002` trigger_short_book_generation 인증+중복방지 (P1-3, P3-14)
- `20260529000003` net_http_post_cover 제한 (P2-4)
- `20260529000004` chapter-photos 경로 소유권 (P2-6)
- `20260529000005` comment_reactions 이모지 정합 (P2-8)
- `20260529000006` notifications 가족서클 INSERT + shares_family_circle (P2-5)
- `20260529000007` reply-audio 범위 읽기 + can_access_reply_audio (P2-7)
- `20260529000008` handle_new_user search_path (P4-19)
- → 적용: `supabase db push` 또는 MCP `apply_migration`. **순서 중요**(000006 → 000007 의존).

**Edge Function (재배포 필요):**
- `generate-book` (P1-1 JWT 인증 `auth.ts`, P2-9 chapter_count 보강) → `supabase functions deploy generate-book`

**프론트엔드 (빌드/배포):**
- useBookEdit(P3-11), SeniorBookReadPage(P2-8 UI는 DB측, P3-12, P4-18), BookEditPage(P3-13), useVoiceReply(P3-15), useVoiceChat(P3-16), useNotifications(P4-17)

## ✅ 추가: generate-book job_id IDOR 차단 (P1-1 인접, CRITICAL급)

- **파일**: `supabase/functions/generate-book/index.ts`, `auth.ts`(canProcessJob), `auth.test.ts`
- **문제**: (1) `job_id` 경로에서 인증 사용자가 **타인 pending job_id**를 넘겨도 소유권 미검증 → 타인 job 처리 트리거(IDOR). (2) `senior_id` 디버그 경로 + 빈 body 배치 경로도 인증 사용자가 임의 senior 생성/전체 배치를 트리거 가능(말일 체크 우회).
- **해결**: 인증 블록에서 `isInternalCall`(service_role 여부) + `callerUserId`(auth.getUser().user.id) 포착. job_id 경로: `canProcessJob(isInternalCall, callerUserId, pendingJob.senior_id)` 거짓이면 403. job_id 없는 경로(senior_id/배치): `!isInternalCall`이면 403(내부 전용). 프론트는 항상 본인 job_id로만 호출 → 영향 없음.
- **검증**: `canProcessJob` 단위 테스트 4개 추가(내부=허용, 본인=허용, 타인=차단, uid없음=차단) → 총 11개 전부 통과. `deno check` 36개(기존, 신규 0).

## 잔여(선택) 항목
- P2-4 net_http_post_cover 오버로드 3개 정리(PostgREST 모호성)
- P2-9 완전 원자성(RPC 트랜잭션 A안) — 파이프라인 E2E 테스트 가능 시
