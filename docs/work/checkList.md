# 배포 체크리스트

> 마이그레이션 실행 전후로 확인해야 할 항목들입니다.

---

## 1. 마이그레이션 실행 전

- [ ] Supabase 프로젝트 URL 및 키 확인
- [ ] `pg_cron` 익스텐션 활성화 (대시보드 Database > Extensions > pg_cron)
- [ ] `pg_net` 익스텐션 활성화 (대시보드 Database > Extensions > pg_net)

---

## 2. 마이그레이션 실행 후

### 2.1 DB 레벨 설정값 주입 (008_cron.sql 의존)

`008_cron.sql`의 pg_cron 잡이 Edge Function을 호출할 때 아래 설정값을 참조합니다.
마이그레이션 실행 후 반드시 아래 SQL을 Supabase SQL Editor에서 직접 실행하세요.

```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres SET app.supabase_service_role_key = '<service-role-key>';
```

> ⚠️ `service_role` 키는 절대 커밋하지 않습니다. Supabase 대시보드 Settings > API에서 확인하세요.

### 2.2 Storage 버킷 확인

- [ ] `avatars` 버킷 public 설정 확인
- [ ] `book-covers` 버킷 public 설정 확인
- [ ] `reply-audio` 버킷 private 설정 확인

### 2.3 Realtime 확인

- [ ] `notifications` 테이블 Realtime 활성화 확인
- [ ] `comments` 테이블 Realtime 활성화 확인
- [ ] `replies` 테이블 Realtime 활성화 확인

### 2.4 pg_cron 잡 등록 확인

아래 SQL로 잡이 정상 등록됐는지 확인합니다.

```sql
SELECT jobname, schedule, active FROM cron.job;
```

예상 결과:
| jobname | schedule | active |
|---------|----------|--------|
| monthly-book-generation | 0 0 1 * * | true |
| expire-invites | 0 * * * * | true |
| cleanup-conversations | 0 3 * * 0 | true |

---

## 3. Edge Function 배포

- [ ] `voice-chat` 배포
- [ ] `extract-memory` 배포
- [ ] `tag-utterances` 배포
- [ ] `generate-book` 배포
- [ ] `generate-cover` 배포
- [ ] `retry-book-job` 배포
