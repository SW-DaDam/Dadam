# Claude Code 스킬 가이드

> 팀원들이 Claude Code를 효율적으로 사용할 수 있도록 주요 스킬을 정리한 문서입니다.
> 스킬 사용법: Claude Code 채팅창에 `/스킬명` 또는 AI가 자동으로 판단하여 사용합니다.

---

## 플러그인 설치 (최초 1회)

스킬은 플러그인 단위로 설치합니다. 아래 명령어를 터미널에서 실행하세요.

```bash
# 개발 워크플로우 전반 (brainstorm, TDD, debugging, git worktree 등)
claude plugins install superpowers@claude-plugins-official

# 기능 개발 가이드 (코드 탐색, 아키텍처 설계 에이전트)
claude plugins install feature-dev@claude-code-plugins

# Git 커밋 / PR 자동화
claude plugins install commit-commands@claude-plugins-official

# PR 코드 리뷰 툴킷
claude plugins install pr-review-toolkit@claude-plugins-official

# 프론트엔드 UI 설계
claude plugins install frontend-design@claude-plugins-official

# Chrome DevTools 디버깅
claude plugins install chrome-devtools-mcp@claude-plugins-official

# Supabase 전용 스킬
claude plugins install supabase@supabase-agent-skills
claude plugins install postgres-best-practices@supabase-agent-skills

# CLAUDE.md 관리
claude plugins install claude-md-management@claude-plugins-official
```

> 설치 후 Claude Code를 재시작하면 스킬이 활성화됩니다.

---

## 개발 워크플로우
> 플러그인: `superpowers@claude-plugins-official`, `feature-dev@claude-code-plugins`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `superpowers:brainstorming` | 아이디어 탐색 및 설계 방향 도출 | 새 기능 구현 **전** 반드시 사용 |
| `superpowers:writing-plans` | 요구사항을 단계별 구현 계획으로 정리 | 복잡한 작업 착수 전 |
| `superpowers:executing-plans` | 작성된 계획을 실행 | 계획 수립 후 구현 시작 시 |
| `feature-dev:feature-dev` | 코드베이스 구조를 파악하고 기능 개발 | 기존 코드에 새 기능 추가 시 |
| `superpowers:test-driven-development` | TDD 방식으로 기능/버그픽스 구현 | 테스트 먼저 작성하고 싶을 때 |
| `superpowers:systematic-debugging` | 버그 원인 추적 및 해결 | 오류/예상치 못한 동작 발생 시 |

---

## Git / PR
> 플러그인: `commit-commands@claude-plugins-official`, `superpowers@claude-plugins-official`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `commit-commands:commit` | 변경사항 커밋 생성 | 작업 단위 저장 시 |
| `commit-commands:commit-push-pr` | 커밋 + 푸시 + PR 오픈 한 번에 처리 | 기능 완료 후 PR 제출 시 |
| `commit-commands:clean_gone` | 원격에서 삭제된 로컬 브랜치 일괄 정리 | 브랜치가 쌓였을 때 |
| `superpowers:using-git-worktrees` | 작업 공간 격리가 필요한 브랜치 작업 | 여러 기능을 동시에 작업할 때 |
| `superpowers:finishing-a-development-branch` | 구현 완료 후 브랜치 통합 결정 지원 | 기능 개발 마무리 시 |

---

## 코드 리뷰 / 품질 검증
> 플러그인: `pr-review-toolkit@claude-plugins-official`, `superpowers@claude-plugins-official`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `pr-review-toolkit:review-pr` | PR 종합 리뷰 (버그, 스타일, 보안 등) | PR 머지 전 |
| `superpowers:requesting-code-review` | 작업 완료 후 코드 리뷰 요청 준비 | 팀원 리뷰 요청 전 |
| `superpowers:receiving-code-review` | 리뷰 피드백 수신 및 반영 계획 수립 | 코드 리뷰 받은 후 |
| `superpowers:verification-before-completion` | 완료 선언 전 최종 검증 | "작업 끝났다" 하기 전 |
| `simplify` | 변경된 코드 품질·효율성 개선 | 구현 후 코드 정리 시 |
| `security-review` | 현재 브랜치 변경사항 보안 취약점 점검 | 배포 전 보안 검토 시 |

---

## 프론트엔드
> 플러그인: `frontend-design@claude-plugins-official`, `chrome-devtools-mcp@claude-plugins-official`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `frontend-design:frontend-design` | 고품질 UI 컴포넌트 및 인터페이스 설계·구현 | 화면 디자인/컴포넌트 작업 시 |
| `chrome-devtools-mcp:chrome-devtools` | Chrome DevTools를 통한 디버깅 및 자동화 | 브라우저 동작 디버깅 시 |
| `chrome-devtools-mcp:a11y-debugging` | 접근성(a11y) 문제 감지 및 수정 | 접근성 개선 작업 시 |
| `chrome-devtools-mcp:debug-optimize-lcp` | LCP(최대 콘텐츠풀 페인트) 성능 최적화 | 페이지 로딩 속도 개선 시 |

---

## Supabase
> 플러그인: `supabase@supabase-agent-skills`, `postgres-best-practices@supabase-agent-skills`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `supabase:supabase` | Supabase 전반 (DB, Auth, Storage, Edge Functions 등) | Supabase 관련 모든 작업 |
| `supabase:supabase-postgres-best-practices` | Postgres 쿼리 최적화 및 인덱싱 베스트 프랙티스 | DB 성능 이슈 발생 시 |

---

## 병렬 작업 (대규모 작업 시)
> 플러그인: `superpowers@claude-plugins-official`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `superpowers:dispatching-parallel-agents` | 독립적인 작업 2개 이상을 병렬로 처리 | 서로 관련 없는 작업을 동시에 할 때 |
| `superpowers:subagent-driven-development` | 구현 계획의 독립 태스크를 서브에이전트로 분산 실행 | 큰 기능을 여러 파트로 나눠 개발할 때 |

---

## 설정 관리
> 플러그인: `superpowers@claude-plugins-official`, `claude-md-management@claude-plugins-official`

| 스킬 | 설명 | 사용 시점 |
|------|------|-----------|
| `update-config` | Claude Code `settings.json` 구성 (훅, 권한, 환경변수 등) | 자동화 동작 설정 시 |
| `claude-md-management:revise-claude-md` | 세션에서 배운 내용을 CLAUDE.md에 반영 | 협업 규칙 업데이트 시 |
| `init` | 새 프로젝트에 CLAUDE.md 초기화 | 신규 레포지토리 시작 시 |

---

## 권장 사용 순서 (일반적인 기능 개발 흐름)

```
1. brainstorming    → 아이디어 정리
2. writing-plans    → 구현 계획 수립
3. feature-dev      → 코드 작성
4. simplify         → 코드 정리
5. verification     → 완료 전 검증
6. commit-push-pr   → 커밋 + PR
7. review-pr        → 리뷰
```

---

> **참고**: 스킬은 Claude Code가 대화 맥락을 보고 자동으로 적용하기도 합니다.
> 명시적으로 사용하려면 `/스킬명` 형식으로 입력하세요.
