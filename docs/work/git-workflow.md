# Git 워크플로우

> **문서 버전**: v1.0
> **작성일**: 2026-04-17
> **관련 문서**: [role-assignment.md](./role-assignment.md) · [code-convention.md](./code-convention.md) · [api-spec.md](./api-spec.md)
> **적용 범위**: 저장소 전체 (브랜치 · 커밋 · PR · 이슈)

---

## 0. 이 문서를 읽는 법

- 본 문서는 **2인 팀(권오인·이지형) × 9주 × 17개 병렬 브랜치** 상황에서 충돌과 혼선을 줄이기 위한 최소 규약입니다.
- 브랜치 목록은 [role-assignment.md §2](./role-assignment.md#2-기능별-분담표)를 정본으로 하고, 본 문서는 운영 규칙만 정의합니다.
- 공유 인터페이스(타입 · 마이그레이션 · RPC · Realtime · Storage) 변경은 [api-spec.md §6](./api-spec.md#6-변경-프로세스)의 변경 프로세스와 연동합니다.

---

## 1. 브랜치 전략

### 1.1 브랜치 역할

| 브랜치 | 용도 | 직접 push | 머지 방향 |
|--------|------|-----------|-----------|
| `main` | 배포 전용(프로덕션 기준) | **금지** | `develop` → `main` PR만 |
| `develop` | 통합 테스트 · 기본 작업 기준 | **금지** (PR만) | `feature/*` / `fix/*` → `develop` |
| `feature/{F번호-기능명}` | 기능 개발 | 허용 (본인 브랜치 한정) | `develop`으로 PR |
| `fix/{이슈번호-요약}` | 버그 수정 | 허용 (본인 브랜치 한정) | `develop`으로 PR (긴급 시 `main`도 가능) |

> `feature/*` 브랜치 전체 목록은 [role-assignment.md §2](./role-assignment.md#2-기능별-분담표) 참조 (17개).

### 1.2 브랜치 수명

- **머지 후에도 영구 보존** (삭제 금지).
- 이유:
  1. 과거 작업 흐름·PR 연결을 추적하기 쉽고,
  2. 2인 팀에서 실수 복구 시 안전망이 되며,
  3. 9주 MVP 이후 회고·리팩터 시 컨텍스트 복원이 용이합니다.
- 프로젝트 종료(2026-06-16) 후 일괄 정리 여부는 팀 회고에서 재논의합니다.

### 1.3 브랜치 생성 예시

```bash
# feature 브랜치: role-assignment.md의 F번호 + 간단한 한글/영문 요약
git switch develop
git pull origin develop
git switch -c feature/F-03-bookshelf

# fix 브랜치: GitHub 이슈 번호 + 요약
git switch -c fix/42-kakao-login-redirect
```

---

## 2. 커밋 컨벤션

### 2.1 형식

```
<타입>: <한글 요약 50자 이내>

(선택) 본문: 변경 이유·배경·참조 이슈
```

- **타입은 한글 키워드로 고정**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- 제목은 한글, 본문은 한글/영문 모두 허용
- 마침표 없이 끝내고, 명령형보다 **변경 결과를 서술**

### 2.2 타입 정의

| 타입 | 의미 | 예시 |
|------|------|------|
| `feat` | 새 기능 추가 | `feat: 카카오 로그인 구현` |
| `fix` | 버그 수정 | `fix: 책장 정렬 순서 역전 버그 해결` |
| `docs` | 문서만 변경 | `docs: api-spec RPC 예시 추가` |
| `style` | 포맷팅·세미콜론 등 동작 무관 변경 | `style: import 순서 정리` |
| `refactor` | 기능 변화 없는 내부 구조 개선 | `refactor: useVoiceChat 훅 분리` |
| `test` | 테스트 추가·수정 | `test: publish_book RPC 단위 테스트 추가` |
| `chore` | 빌드·의존성·설정 등 | `chore: vitest 3.2로 업그레이드` |

### 2.3 작은 단위 원칙

- **1개 논리 변경 = 1 커밋**. 포맷 정리와 로직 변경을 한 커밋에 섞지 않습니다.
- 리뷰어가 한 커밋을 10분 이내에 읽을 수 있는 크기를 목표로 합니다.
- WIP 커밋은 PR 직전 `git rebase -i`로 정리 가능(본인 브랜치 한정).

### 2.4 좋은 커밋 예시

```
feat: 카카오 로그인 구현
feat: 책장 3단 그리드 레이아웃 추가
fix: 녹음 권한 거부 시 에러 토스트 노출
refactor: Supabase 클라이언트 싱글톤으로 정리
docs: Realtime 채널 cleanup 패턴 명세
test: soft_delete_chapter RPC 성공/실패 케이스
chore: tailwindcss 4.1.14 고정
```

### 2.5 안 좋은 커밋 예시 (피할 것)

```
수정                          # 무엇을 수정했는지 불명
update                        # 영문 타입 불일치 + 내용 없음
feat: 여러가지 작업            # 범위 불명확
feat: 로그인 구현 + 책장 UI    # 한 커밋에 두 가지 변경
```

---

## 3. Pull Request 규칙

### 3.1 PR 방향

```
feature/* ─┐
           ├─▶ develop ─▶ main
fix/*    ──┘
```

- `feature/*` · `fix/*` → **반드시 `develop`으로 PR** (긴급 hotfix 제외).
- `develop` → `main` PR은 스프린트 마감(금요일) 또는 배포 직전에 합의하여 생성합니다.

### 3.2 PR 제목

형식: `[타입] 한글 요약`

```
[feat] 카카오 로그인 구현
[fix] 녹음 권한 거부 시 UX 개선
[refactor] Supabase 클라이언트 경로 정리
[api!] publish_book RPC 시그니처 변경 (Breaking)
```

- 공유 인터페이스(타입/RPC/Realtime/Storage)에 **Breaking Change**가 있으면 `[api!]` 접두사 사용.
- Breaking Change 판정 기준은 [api-spec.md §6](./api-spec.md#6-변경-프로세스) 참조.

### 3.3 PR 본문 템플릿

아래 템플릿을 `.github/pull_request_template.md`로 저장해 자동 주입합니다.

```markdown
## 변경 사항
<!-- 무엇을 왜 바꿨는지 3~5줄 -->

## 관련 이슈
Closes #

## 스크린샷 / 동작 영상
<!-- UI 변경 시 필수, 없으면 "해당 없음"이라고 명시 -->

## 일반 체크리스트
- [ ] `npm run lint` 통과
- [ ] `npm run build` 성공 (tsc 타입 체크 포함)
- [ ] 로컬에서 기능 동작 확인 (시나리오 요약)
- [ ] [code-convention.md](../docs/work/code-convention.md) §11 PR 체크리스트 부합

## 공유 인터페이스 영향
- [ ] 없음
- [ ] 있음 — 아래 해당 항목 표시 & 본문에 `@상대방` 멘션 + `breaking` 라벨
  - [ ] `src/types/database.ts` / `src/types/domain.ts` 변경
  - [ ] `supabase/migrations/*` 추가·수정 (RLS 포함)
  - [ ] RPC 함수 추가·시그니처 변경 ([api-spec.md §2](../docs/work/api-spec.md#2-rpc-함수-명세))
  - [ ] Realtime 채널 규약 변경 ([api-spec.md §3](../docs/work/api-spec.md#3-realtime-채널-명세))
  - [ ] Storage 경로 규칙 변경 ([api-spec.md §4](../docs/work/api-spec.md#4-storage-경로-규약))
  - [ ] Edge Function 시그니처·응답 스키마 변경 ([api-spec.md §7](../docs/work/api-spec.md#7-edge-function-호출-공통-패턴))
```

### 3.4 머지 규칙

- **리뷰어 지정 필수**: 상대방(권오인 ↔ 이지형)을 리뷰어로 지정합니다.
- **셀프 머지 금지**: 상대방 Approve 없이 머지하지 않습니다.
  - 예외: 상대방이 48시간 내 리뷰 불가한 경우 Slack/DM으로 사전 동의를 얻고, PR 본문에 사유를 남깁니다.
- **머지 방식**: `Squash and merge` 기본. 커밋 히스토리가 이미 잘 정리된 PR만 `Rebase and merge` 허용.
- **Merge commit 금지**: `--no-ff` merge는 사용하지 않습니다(히스토리 단순화 목적).

### 3.5 리뷰 SLA

- PR 생성 후 **24시간 이내 1차 리뷰**를 목표로 합니다.
- 긴급(`fix/*`, 빌드 깨짐)은 2시간 이내 응답을 지향합니다.
- 응답 지연 시 Slack/DM으로 리마인드 후 PR 본문에 지연 사유를 기록합니다.

---

## 4. 충돌 처리 우선순위

여러 브랜치가 같은 파일을 건드릴 때의 조율 기준입니다.

| 충돌 영역 | 조정 기준 | 비고 |
|-----------|-----------|------|
| `src/types/database.ts` | **권오인 기준 우선** | Supabase 스키마 원본이 백엔드이므로. 프론트는 최신 생성본에 맞춰 재조정 |
| `supabase/migrations/*` | **권오인 조율 필수** | 마이그레이션 순서·번호 충돌 방지 |
| `supabase/seed.sql` | **권오인 조율 필수** | 테스트 데이터 일관성 |
| `src/types/domain.ts` | **PR 순서** (먼저 머지된 쪽 유지) | 뒤 PR이 rebase 후 재조정 |
| 공유 라우팅 / 레이아웃 (`src/App.tsx`, `src/pages/*` 공용) | **먼저 머지한 쪽 유지** | 뒤 PR이 적응 |
| Tailwind 설정 (`tailwind.config.ts` · 전역 CSS) | **사전 Slack 합의** 후 작성 | 디자인 토큰 충돌 방지 |
| 그 외 본인 담당 폴더 | 작성자 재량 | 상대방 담당 폴더 수정 시 사전 합의 |

> 담당 폴더 경계는 [role-assignment.md §5](./role-assignment.md#5-파일-디렉터리-오너십) 오너십 표를 따릅니다.

---

## 5. 이슈 · 프로젝트 보드

### 5.1 GitHub Issues

- **이슈 제목**: `[F-XX] 기능명` (F번호는 role-assignment.md §2와 동일)
  - 예: `[F-03] 책장 3단 그리드 구현`
  - 버그는 `[BUG] 요약` 형식 허용 (예: `[BUG] 녹음 중 페이지 이탈 시 메모리 누수`)
- **필수 필드**: 담당자(Assignee), 라벨, 마일스톤(주차 기준)
- **라벨 예시**: `feature`, `bug`, `docs`, `breaking`, `blocked`, `help-wanted`
- **이슈 본문**: 배경 · 수용 기준(Acceptance Criteria) · 관련 PRD 섹션 링크 포함

### 5.2 프로젝트 보드 (GitHub Projects)

칸반 4단계:

```
Todo ─▶ In Progress ─▶ Review ─▶ Done
```

- 작업 시작 시 이슈를 `In Progress`로, PR 생성 시 `Review`로, 머지 후 `Done`으로 이동합니다.
- **PR은 반드시 이슈와 연결**: PR 본문에 `Closes #이슈번호`를 기재해 자동 close 되도록 합니다.
- 이슈 없이 PR을 먼저 올려야 할 때는 머지 전에 이슈를 생성해 연결합니다.

---

## 6. 스프린트 사이클 (주간)

| 요일 | 활동 | 비고 |
|------|------|------|
| 월요일 | 주간 목표 확정 · 이슈 재조정 | ROADMAP.md(있을 경우) 또는 role-assignment §7 기준 |
| 화~목 | 기능 개발 · PR 생성 · 상호 리뷰 | SLA 24h 이내 리뷰 |
| 금요일 | 데모 + 회고 + `develop → main` 머지 판단 | role-assignment §7 연동 |

- 금요일 회고에서 **막힌 지점·충돌 영역·API 변경 이력**을 점검합니다.
- 주간 목표 대비 지연된 이슈는 다음 주 월요일 회의에서 재배치합니다.

---

## 7. 코드 리뷰 체크리스트 (리뷰어용)

리뷰어는 다음 관점을 점검합니다. 작성자가 스스로 먼저 확인한 뒤 PR을 올리는 것을 권장합니다.

- **스타일**
  - [ ] [code-convention.md](./code-convention.md) 네이밍·파일 구조·주석 규약 부합
  - [ ] 매직 넘버 없음, 상수 추출 여부
- **타입**
  - [ ] `any` 사용 여부 (불가피 시 `unknown` + 좁히기)
  - [ ] Supabase 타입은 `src/types/database.ts` 재생성본 기반인지
- **보안**
  - [ ] RLS 우회 쿼리(서비스 로직에서 `service_role` 키 노출) 없음
  - [ ] `.env`·키 파일 커밋 없음
  - [ ] 클라이언트 번들에 비밀값 하드코딩 없음
- **에러 처리**
  - [ ] Supabase 호출 `{ data, error }` 분기 누락 없음
  - [ ] Edge Function 호출 실패 시 사용자 피드백(토스트 등) 존재
- **API 계약**
  - [ ] 공유 인터페이스 변경 시 [api-spec.md](./api-spec.md) 동반 업데이트
  - [ ] Breaking Change는 `[api!]` 접두사 + `breaking` 라벨
- **테스트 / 수동 확인**
  - [ ] UI 변경은 스크린샷 또는 영상 첨부
  - [ ] 시니어 UX(폰트 `text-lg`↑, 터치 타깃 `min-h-11`↑) 유지 (프론트 PR)

---

## 8. 금지 사항

- ❌ `main` 브랜치 **직접 push** (무조건 PR 경유)
- ❌ `main` · `develop` **force push**
- ❌ 상대방 브랜치에 **직접 force push** (본인 브랜치라도 공동 작업 중이면 사전 합의)
- ❌ `git commit --no-verify` / `git push --no-verify` (pre-commit 훅 우회)
- ❌ `.env`, 서비스 키 파일, `node_modules/`, 빌드 산출물 커밋
- ❌ 상대방 리뷰 없이 **셀프 머지**
- ❌ 머지 완료된 브랜치 **삭제** (§1.2 수명 규칙)
- ❌ Supabase 프로젝트 키(`service_role`, anon 등)를 PR 본문·스크린샷에 노출

> 위 금지 사항 위반이 발생한 경우, 발견자는 즉시 Slack/DM으로 상대방에게 알리고 함께 롤백·재발 방지 절차를 진행합니다.

---

## 9. 자주 쓰는 Git 명령 (2인 팀 기준)

```bash
# 최신 develop 반영 후 feature 작업 시작
git switch develop && git pull origin develop
git switch -c feature/F-03-bookshelf

# 작업 중 develop 변경 반영 (rebase 권장, 충돌 시 상대방과 합의)
git fetch origin
git rebase origin/develop

# PR 생성 전 커밋 정리 (본인 브랜치 한정)
git rebase -i origin/develop

# 원격 push (첫 push 시 -u로 upstream 설정)
git push -u origin feature/F-03-bookshelf

# 머지 완료 후 로컬 정리 (원격 브랜치는 보존, 로컬만 정리)
git switch develop && git pull origin develop
git branch -d feature/F-03-bookshelf
```

> `git rebase -i`로 히스토리 재작성 후 push는 **본인 혼자 쓰는 브랜치에 한해** `--force-with-lease` 사용을 권장합니다(`--force` 대신).

---

## 10. 변경 이력

| 버전 | 날짜 | 변경자 | 내용 |
|------|------|--------|------|
| v1.0 | 2026-04-17 | 팀 합의 | 최초 작성 (과거 `docs/rules.md` 대체) |
