# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. 프로젝트 개요

- **프로덕트**: 다담(오브젠) — AI 말동무 기반 시니어용 "가족 출판 플랫폼"
- **팀**: 권오인(백엔드 · AI · Edge Function) + 이지형(프론트 · 시니어 UI · Realtime) / 2인
- **일정**: 2026-04-10 ~ 2026-06-16 (9주, 17개 기능)
- **현재 브랜치**: `develop` (기본 작업 브랜치), `main`은 배포 전용

## 2. 협업 도구 분업 (중요)

본 저장소는 **Claude + Codex 듀얼 에이전트** 방식으로 운영합니다.

| 단계 | 담당 | 역할 |
|------|------|------|
| 구현 플랜 작성 | **Claude Code** | 기능 분석, 작업 계획 수립 |
| 코드 작성 | **Claude Code** | 플랜 기반으로 기능 구현, 리팩터, 문서 작성 |
| 코드 검증 (커밋 전) | **Codex** | 구현 코드의 로직·엣지 케이스·리스크 점검, 수정 의견 |
| 수정 반영 후 커밋 | **Claude Code** | Codex 의견 반영 여부 판단 후 커밋 |

- **운영 규약**
  - Claude가 코드를 작성한 뒤, **커밋 전에** Codex가 구현 코드를 검증합니다.
  - Codex 의견은 사용자를 통해 전달되며, 반영 여부는 작성자가 판단합니다.
  - Claude는 Codex 검증 결과를 추측하지 말고, 사용자 또는 실제 검증 로그가 전달된 뒤에만 반영합니다.
- **✅ 현재 상태**: **Codex 연결 완료** (2026-04-22). ChatGPT 계정 로그인 방식으로 연결됨.

## 3. 문서 맵 (정본 참조)

작업 전 아래 문서를 **정본(source of truth)** 으로 삼고, CLAUDE.md는 인덱스 역할만 합니다.

### 기획 · 설계 (`docs/dev/`)
- [PRD.md](./docs/dev/PRD.md) — 제품 요구사항 (기능 번호 F-01~F-17 정의)
- [FRD.md](./docs/dev/FRD.md) — 17개 기능 상세 스펙
- [erd.md](./docs/dev/erd.md) — 데이터 모델 · RLS · Enum (**DB 스키마 정본**)
- [tech-stack.md](./docs/dev/tech-stack.md) — 기술 스택 상세
- [datasets.md](./docs/dev/datasets.md) — 데이터셋 정리

### 협업 · 운영 (`docs/work/`)
- [role-assignment.md](./docs/work/role-assignment.md) — 역할 분담, 브랜치 17개, 인터페이스 계약(§4), 오너십(§5)
- [code-convention.md](./docs/work/code-convention.md) — 코드 스타일 · 네이밍 · 주석 규약
- [api-spec.md](./docs/work/api-spec.md) — RPC 7개 · Realtime 3개 · Storage 3개 · Edge Function 호출 패턴
- [git-workflow.md](./docs/work/git-workflow.md) — 브랜치 · 커밋 · PR · 리뷰 · 금지 사항
- [ROADMAP.md](./docs/work/ROADMAP.md) / [ROADMAP-권오인.md](./docs/work/ROADMAP-권오인.md) / [ROADMAP-이지형.md](./docs/work/ROADMAP-이지형.md) — 일정
- [budget.md](./docs/work/budget.md) — 예산

> **규칙**: 위 문서 내용과 CLAUDE.md 지시가 충돌하면 **각 정본 문서를 우선**합니다. CLAUDE.md는 요약이고, 세부 규칙은 해당 문서에서 갱신됩니다.

## 4. 저장소 구조 (한눈에)

```
Dadam/
├── docs/               # 기획·협업 문서 (위 §3 참조)
├── frontend/           # React 19 + TS + Vite + Tailwind v4 + Supabase JS
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── features/   # 기능 단위 (F번호 기준으로 분리)
│   │   ├── routes/     # 라우팅 (React Router v7 도입 예정)
│   │   ├── shared/     # 공용 컴포넌트·훅·유틸
│   │   └── lib/        # Supabase 클라이언트 등 외부 연동
│   ├── public/
│   └── package.json
└── CLAUDE.md
```

상세 컴포넌트 구조·배럴 파일 규칙은 [code-convention.md §2](./docs/work/code-convention.md) 참조.

## 5. 자주 쓰는 명령 (frontend 기준)

> 모든 명령은 `frontend/` 디렉터리에서 실행합니다.

| 명령 | 용도 |
|------|------|
| `npm run dev` | 개발 서버 (Vite HMR) |
| `npm run build` | `tsc -b` 타입 체크 + Vite 프로덕션 빌드 |
| `npm run lint` | ESLint 실행 |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |
| `npm test` | Vitest 1회 실행 |
| `npm run test:watch` | Vitest watch 모드 |
| `npx vitest run path/to/file.test.ts` | 단일 테스트 파일 실행 |
| `npx vitest run -t "케이스명"` | 특정 테스트 케이스만 실행 |

## 6. 핵심 아키텍처 (Big Picture)

### 6.1 Supabase 기반 BaaS 아키텍처
- 클라이언트(`frontend/`) ↔ Supabase(Postgres + Auth + Realtime + Storage + Edge Function) 구조.
- **백엔드 코드 = DB(마이그레이션 · RLS · RPC) + Edge Function**. 별도 서버 없음.
- 클라이언트에서는 **`service_role` 키 사용 금지** — anon 키 + RLS로만 접근.

### 6.2 인터페이스 계약 (변경 시 PR에 상대방 멘션 필수)
네 가지 경계면이 있고, 각각 api-spec.md가 계약서 역할을 합니다.

| 경계 | 실체 | 정본 문서 |
|------|------|-----------|
| 타입 | `src/types/database.ts` (자동 생성) · `src/types/domain.ts` (join/도메인 복합 타입) | [code-convention.md §4](./docs/work/code-convention.md) |
| RPC | 7개 함수 (soft_delete_chapter, restore_chapter, update_chapter_title, select_cover, publish_book, retry_book_generation, create_signed_reply_audio_url) | [api-spec.md §2](./docs/work/api-spec.md) |
| Realtime | 3채널 (`notifications:user:*`, `comments:chapter:*`, `replies:comment:*`) | [api-spec.md §3](./docs/work/api-spec.md) |
| Storage | 3버킷 (`avatars` public, `book-covers` public/service_role, `reply-audio` private/signed URL) | [api-spec.md §4](./docs/work/api-spec.md) |

변경 프로세스: [api-spec.md §6](./docs/work/api-spec.md).

### 6.3 기능 분담 · 브랜치 모델
- 17개 기능 각각이 `feature/F-XX-이름` 브랜치를 가지며 **머지 후에도 영구 보존**합니다([git-workflow.md §1.2](./docs/work/git-workflow.md)).
- 수직 슬라이싱: 담당자가 해당 기능의 프론트 + Edge Function + RLS + 마이그레이션을 모두 작성합니다.
- 담당·브랜치 목록은 [role-assignment.md §2](./docs/work/role-assignment.md).

### 6.4 Edge Function (6개, 권오인 전담)
voice-chat · extract-memory · tag-utterances · generate-book · generate-cover · retry-book-job — 호출 규약은 [api-spec.md §7](./docs/work/api-spec.md).

## 7. 작업 시 체크리스트 (Claude 전용)

코드를 작성·수정하기 전 다음을 확인합니다.

1. **정본 문서 확인**: 관련 기능이 `docs/dev/FRD.md` · `docs/dev/erd.md` 어디에 정의되어 있는지 먼저 읽는다.
2. **오너십 확인**: [role-assignment.md §5](./docs/work/role-assignment.md) 기준으로 내가 수정하려는 경로가 누구 담당인지 확인. 상대 담당 영역이면 사용자에게 먼저 알린다.
3. **인터페이스 변경 여부**: §6.2 네 가지 경계(타입 · RPC · Realtime · Storage)에 영향이 있으면 api-spec.md와 함께 업데이트하고 PR 본문 체크리스트에 표시한다.
4. **컨벤션 준수**: [code-convention.md](./docs/work/code-convention.md) — any 금지, 매직넘버 금지, 시니어 UX(`text-lg`↑ · 터치 타깃 `min-h-11`↑) 유지.
5. **커밋 · PR**: [git-workflow.md §2-§3](./docs/work/git-workflow.md) — 한글 타입 접두사, 셀프 머지 금지, Breaking Change는 `[api!]`.
6. **Codex 검증 단계 체크**: §2 기준. 커밋 전 Codex 검증을 거쳐야 한다. 검증 결과를 추측하거나 임의로 "완료"로 표시하지 않는다.
7. **완료 증명**: 태스크를 완료로 표시하기 전, 실제로 동작함을 확인한다 — 테스트 실행, 로그 확인, 또는 동작 시연. "코드를 작성했다"는 완료가 아니다.
8. **우아함 점검**: 비자명한 변경이라면 "더 우아한 방법이 있는가?" 스스로 묻는다. 해키하게 느껴지면 근본 원인을 해결한다. 단순·명백한 수정은 생략해도 된다.

## 9. 태스크 추적 · 자기개선

### 플랜 파일
- 비자명한 작업(3단계 이상 또는 아키텍처 결정)은 `tasks/todo.md`에 체크리스트로 플랜을 먼저 작성한다.
- 플랜 확인 후 바로 구현 진행 — 커밋 전 Codex 검증(§2)만 지키면 된다.
- 각 항목은 완료 즉시 체크한다. 완료 후 결과 리뷰 섹션을 추가한다.

### 자율 버그 수정
- 버그 리포트를 받으면 바로 수정한다. 사용자에게 방법을 물어보지 않는다.
- 로그·에러·실패 테스트를 직접 확인하고 근본 원인을 해결한다.
- 수정 후 커밋 전에 Codex 검증(§2)을 거친다.

### 자기개선 루프
- 사용자의 수정 지적을 받은 뒤: `tasks/lessons.md`에 패턴과 재발 방지 규칙을 기록한다.
- 세션 시작 시 `tasks/lessons.md`를 검토하여 과거 실수를 반복하지 않는다.

## 8. 절대 금지

[git-workflow.md §8](./docs/work/git-workflow.md)의 금지 사항을 그대로 따릅니다. 주요 항목:

- `main` / `develop` 직접 push · force push
- `--no-verify`로 pre-commit 훅 우회
- `.env`, 서비스 키, `service_role` 키의 커밋·로그·스크린샷 노출
- 상대방 리뷰 없는 셀프 머지
- 머지된 브랜치 삭제
- CLAUDE.md에 없는 규칙을 "관례"로 가정하여 작성 — 반드시 정본 문서를 근거로 판단
