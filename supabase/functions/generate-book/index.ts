// generate-book: 월말 자동 책 초안 생성 파이프라인
// 단계: pending → aggregating → chaptering → cover_requested → done (실패 시 failed)
// 트리거: pg_cron (매월 말일) 또는 수동 POST 호출 (service_role 키 필요)

import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { generateText } from 'npm:ai'
import {
  CHAPTERING_SYSTEM_PROMPT,
  buildChapteringUserMessage,
  type BookOutput,
  type UtteranceItem,
  type MemoryItem,
} from './prompts.ts'

// CORS 헤더: pg_cron 내부 호출 + 개발 중 수동 POST 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 발화 선별 기준 태그 (daily_mundane 단독 발화는 제외)
const PRIORITY_TAGS = ['emotional_peak', 'memory_recall', 'philosophy', 'relationship_event']

// 요청 본문 타입 (senior_id 없으면 전체 어르신 대상)
interface GenerateBookRequest {
  senior_id?: string
  job_id?: string  // RPC로 생성된 pending job을 이어서 처리할 때 사용
}

// 어르신 프로필 타입 (aggregating 대상 목록)
interface SeniorProfile {
  id: string
}

// utterances 조회 결과 타입
interface Utterance {
  id: string
  content: string
  tags: string[]
}

/**
 * job status를 지정 단계로 업데이트
 * - 실패 시 error_log에 "[단계명] 에러 메시지" 기록
 */
async function updateJobStatus(
  supabase: ReturnType<typeof createClient>,
  jobId: string,
  status: string,
  extra?: { error_log?: string; stage_payload?: Record<string, unknown>; book_id?: string },
) {
  const patch: Record<string, unknown> = { status }
  if (extra?.error_log !== undefined) patch.error_log = extra.error_log
  if (extra?.stage_payload !== undefined) patch.stage_payload = extra.stage_payload
  if (extra?.book_id !== undefined) patch.book_id = extra.book_id

  const { error } = await supabase
    .from('book_generation_jobs')
    .update(patch)
    .eq('id', jobId)

  if (error) {
    // job 상태 업데이트 실패는 로그만 남기고 파이프라인은 계속 진행
    console.error(`[generate-book] job ${jobId} status → ${status} 업데이트 실패`, error)
  }
}

/**
 * 해당 월 어르신 발화를 수집·선별 (aggregating 단계)
 * 선별 기준:
 *   1. speaker = 'senior'만
 *   2. PRIORITY_TAGS 중 하나라도 보유한 발화 우선
 *   3. daily_mundane 단독 발화 제외
 *   4. 전체의 10~20% 목표 (최소 5건, 최대 40건 캡)
 */
async function aggregateUtterances(
  supabase: ReturnType<typeof createClient>,
  seniorId: string,
  year: number,
  month: number,
): Promise<UtteranceItem[]> {
  // 해당 월 범위 계산
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()   // 다음 달 1일 = 해당 월 말일 다음날

  // 해당 월 어르신의 conversation_id 목록 먼저 조회
  // Supabase JS !inner join 후 조인 테이블 컬럼 필터가 동작하지 않으므로
  // 2단계로 분리: ① conversation_id 조회 → ② utterances 조회
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('senior_id', seniorId)
    .gte('started_at', monthStart)
    .lt('started_at', monthEnd)

  if (convErr) throw new Error(`conversations 조회 실패: ${convErr.message}`)

  const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id)
  if (conversationIds.length === 0) return []

  // 해당 conversation들의 어르신 발화 조회
  const { data: utterances, error } = await supabase
    .from('utterances')
    .select('id, content, tags')
    .eq('speaker', 'senior')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`utterances 조회 실패: ${error.message}`)

  const all: Utterance[] = (utterances ?? []).map((u: {
    id: string
    content: string
    tags: string[]
  }) => ({
    id: u.id,
    content: u.content,
    tags: u.tags ?? [],
  }))

  if (all.length === 0) return []

  // 1순위: PRIORITY_TAGS 보유 발화
  const priority = all.filter((u) =>
    u.tags.some((tag) => PRIORITY_TAGS.includes(tag))
  )

  // 2순위: daily_mundane 단독이 아닌 나머지
  const secondary = all.filter((u) =>
    !priority.includes(u) &&
    !(u.tags.length === 1 && u.tags[0] === 'daily_mundane') &&
    !(u.tags.length === 0)
  )

  // 전체의 10~20% 목표, 최소 5건 최대 40건
  const TARGET_MIN = 5
  const TARGET_MAX = 40
  const target = Math.min(
    TARGET_MAX,
    Math.max(TARGET_MIN, Math.ceil(all.length * 0.15)),
  )

  // 1순위 채우고 부족하면 2순위로 보충
  const selected = [...priority]
  if (selected.length < target) {
    selected.push(...secondary.slice(0, target - selected.length))
  }

  // 최대 캡 적용
  return selected.slice(0, TARGET_MAX).map((u) => ({ id: u.id, content: u.content }))
}

/**
 * aggregating 실패 시 fallback — emotional_peak 태그 발화만 선별 (스펙 §6)
 * 규칙 기반이므로 실패할 이유가 없지만, DB 조회 자체가 실패하면 throw
 */
async function aggregateUtterancesFallback(
  supabase: ReturnType<typeof createClient>,
  seniorId: string,
  year: number,
  month: number,
): Promise<UtteranceItem[]> {
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()

  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('senior_id', seniorId)
    .gte('started_at', monthStart)
    .lt('started_at', monthEnd)

  if (convErr) throw new Error(`fallback conversations 조회 실패: ${convErr.message}`)

  const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id)
  if (conversationIds.length === 0) return []

  const { data: utterances, error } = await supabase
    .from('utterances')
    .select('id, content, tags')
    .eq('speaker', 'senior')
    .in('conversation_id', conversationIds)
    .contains('tags', ['emotional_peak'])   // emotional_peak 태그 보유 발화만
    .order('created_at', { ascending: true })

  if (error) throw new Error(`fallback utterances 조회 실패: ${error.message}`)

  return (utterances ?? []).map((u: { id: string; content: string }) => ({
    id: u.id,
    content: u.content,
  }))
}

/**
 * 단일 어르신 대상 책 생성 파이프라인 실행
 * aggregating → chaptering → cover_requested → done
 * 반환: 'success' | 'failed' | 'skipped'
 *   - failed: job이 failed 상태로 종료됨 (발화 없음, LLM 오류 등)
 *   - skipped: 이미 처리 중이거나 완료된 job이 존재
 *   - success: done 상태로 완료
 *
 * existingPendingJobId: RPC trigger_book_generation()이 미리 만들어 둔 pending job ID
 *   - 지정 시: 해당 job을 이어서 처리 (중복 체크 생략, job 신규 생성 생략)
 *   - 미지정 시: 기존 active job 없으면 새 job 생성
 */
async function runPipelineForSenior(
  callerAuthHeader: string,  // 원래 요청의 Authorization 헤더 (generate-cover 내부 호출 시 전달)
  supabase: ReturnType<typeof createClient>,
  seniorId: string,
  year: number,
  month: number,
  existingPendingJobId?: string,
): Promise<'success' | 'failed' | 'skipped'> {
  let jobId: string

  if (existingPendingJobId) {
    // RPC가 미리 생성한 pending job을 이어서 실행
    jobId = existingPendingJobId
    console.log(`[generate-book] RPC pending job ${jobId} 이어서 실행 (senior: ${seniorId})`)
  } else {
    // ── 중복 방지: aggregating 이상 활성 job이 있으면 skip ───────
    // pending은 제외: 이 함수 외부에서 생성된 pending은 별도 경로로 처리됨
    const { data: existingJob } = await supabase
      .from('book_generation_jobs')
      .select('id, status')
      .eq('senior_id', seniorId)
      .in('status', ['aggregating', 'chaptering', 'cover_requested', 'done'])
      .gte('created_at', new Date(year, month - 1, 1).toISOString())
      .lt('created_at', new Date(year, month, 1).toISOString())
      .maybeSingle()

    if (existingJob) {
      console.log(`[generate-book] senior ${seniorId} 이미 처리됨 (job: ${existingJob.id}, status: ${existingJob.status}), skip`)
      return 'skipped'
    }

    // ── pending: job 신규 생성 ─────────────────────────────────────
    const { data: job, error: jobErr } = await supabase
      .from('book_generation_jobs')
      .insert({
        senior_id: seniorId,
        status: 'pending',
        stage_payload: { target_year: year, target_month: month },
      })
      .select('id')
      .single()

    if (jobErr || !job) {
      console.error(`[generate-book] job 생성 실패 (senior: ${seniorId})`, jobErr)
      return 'failed'
    }

    jobId = job.id
    console.log(`[generate-book] job ${jobId} 생성됨 (senior: ${seniorId})`)
  }

  // ── aggregating: 발화 수집·선별 ───────────────────────────────
  await updateJobStatus(supabase, jobId, 'aggregating')

  let selectedUtterances: UtteranceItem[]
  try {
    selectedUtterances = await aggregateUtterances(supabase, seniorId, year, month)
  } catch (err) {
    // 스펙 §6: aggregating 실패 시 emotional_peak 태그 발화만 fallback 선별
    console.warn(`[generate-book] job ${jobId} — aggregating 실패, emotional_peak fallback 시도:`, err)
    try {
      selectedUtterances = await aggregateUtterancesFallback(supabase, seniorId, year, month)
    } catch (fallbackErr) {
      await updateJobStatus(supabase, jobId, 'failed', {
        error_log: `[aggregating] ${String(err)} / fallback: ${String(fallbackErr)}`,
      })
      return 'failed'
    }
  }

  if (selectedUtterances.length === 0) {
    await updateJobStatus(supabase, jobId, 'failed', {
      error_log: '[aggregating] utterances not found',
    })
    console.log(`[generate-book] job ${jobId} — 발화 0건, failed 처리`)
    return 'failed'
  }

  // aggregated_ids를 stage_payload에 보존 (chaptering 재시도 시 재수집 불필요)
  const aggregatedIds = selectedUtterances.map((u) => u.id)
  await updateJobStatus(supabase, jobId, 'aggregating', {
    stage_payload: { aggregated_ids: aggregatedIds },
  })

  console.log(`[generate-book] job ${jobId} — ${selectedUtterances.length}건 발화 선별 완료`)

  // ── chaptering 전처리: senior_profiles + memories로 저자 프로필 컨텍스트 구성 ──
  // 발화가 주재료, 프로필은 성별·나이·관계명·관심사를 서술에 자연스럽게 반영하는 보조 컨텍스트
  // 조회 실패 시 프로필 없이 진행 (어르신 UX 방해 금지)
  let authorProfile: string | undefined
  try {
    const [{ data: memoryRow }, { data: profileRow }] = await Promise.all([
      supabase.from('memories').select('data').eq('senior_id', seniorId).single(),
      supabase.from('senior_profiles').select('gender, birth_date').eq('id', seniorId).single(),
    ])

    const profileLines: string[] = []
    if (profileRow) {
      if (profileRow.gender) profileLines.push(`- gender: ${profileRow.gender}`)
      if (profileRow.birth_date) {
        const age = new Date().getFullYear() - new Date(profileRow.birth_date).getFullYear()
        profileLines.push(`- age: approx. ${age}`)
      }
    }

    const allItems: MemoryItem[] = (memoryRow?.data as { items?: MemoryItem[] })?.items ?? []
    const today = new Date().toISOString().slice(0, 10)
    const items = allItems.filter((item) => !item.expires_at || item.expires_at > today)
    for (const item of items) {
      profileLines.push(`- [${item.category}] ${item.text} ${item.emoji}`)
    }

    if (profileLines.length > 0) authorProfile = profileLines.join('\n')
  } catch (memErr) {
    console.warn(`[generate-book] job ${jobId} — 저자 프로필 조회 실패, 프로필 없이 진행:`, memErr)
  }

  // ── chaptering: LLM으로 챕터 구성·서사 생성 ───────────────────
  // 스펙 §5: 서사 변환 품질을 위해 gpt-4o 사용 (gpt-4o-mini 대비 서사 품질 우수)
  // 스펙 §6: JSON 파싱 실패 시 1회 재시도
  await updateJobStatus(supabase, jobId, 'chaptering')

  let bookOutput: BookOutput
  try {
    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    const callLLM = () => generateText({
      model: openai('gpt-4o'),
      messages: [
        { role: 'system', content: CHAPTERING_SYSTEM_PROMPT },
        { role: 'user', content: buildChapteringUserMessage(selectedUtterances, authorProfile) },
      ],
      temperature: 0.7,   // 서사 생성은 분류보다 창의성이 필요하므로 0.7 사용
    })

    let text: string
    try {
      const result = await callLLM()
      text = result.text
    } catch (llmErr) {
      // LLM 호출 자체 실패 시 즉시 failed (재시도 없음 — 비용 절감)
      throw llmErr
    }

    // LLM 응답에서 JSON 추출 (```json ... ``` 마크다운 코드블록 포함 대응)
    const extractJson = (raw: string): BookOutput | null => {
      const stripped = raw
        .replace(/^```json\s*/i, '')  // 앞쪽 ```json 제거
        .replace(/^```\s*/i, '')      // 앞쪽 ``` 제거
        .replace(/\s*```\s*$/, '')    // 뒤쪽 ``` 제거
        .trim()
      try {
        return JSON.parse(stripped) as BookOutput
      } catch {
        return null
      }
    }

    // JSON 파싱 실패 시 1회 재시도 (스펙 §6)
    let parsed = extractJson(text)
    if (!parsed) {
      console.warn(`[generate-book] job ${jobId} — JSON 파싱 실패, 1회 재시도`)
      const retry = await callLLM()
      parsed = extractJson(retry.text)
      if (!parsed) throw new Error('JSON 파싱 재시도 실패')
    }

    bookOutput = parsed

    // LLM 출력 기본 검증
    if (!bookOutput.book_title || !Array.isArray(bookOutput.chapters) || bookOutput.chapters.length === 0) {
      throw new Error('LLM 출력 형식 오류: book_title 또는 chapters 누락')
    }
  } catch (err) {
    await updateJobStatus(supabase, jobId, 'failed', {
      error_log: `[chaptering] ${String(err)}`,
    })
    return 'failed'
  }

  // books INSERT
  const { data: book, error: bookErr } = await supabase
    .from('books')
    .insert({
      senior_id: seniorId,
      title: bookOutput.book_title,
      subtitle: bookOutput.book_subtitle ?? null,
      book_type: 'monthly',
      status: 'draft',
      year,
      month,
    })
    .select('id')
    .single()

  if (bookErr || !book) {
    await updateJobStatus(supabase, jobId, 'failed', {
      error_log: `[chaptering] books INSERT 실패: ${bookErr?.message}`,
    })
    return 'failed'
  }

  const bookId = book.id

  // chapters INSERT (sort_order는 배열 인덱스 + 1)
  const chaptersToInsert = bookOutput.chapters.map((ch, idx) => ({
    book_id: bookId,
    title: ch.title,
    theme: ch.theme,
    content: ch.content,
    sort_order: idx + 1,
    source_utterance_ids: ch.source_utterance_ids ?? [],
  }))

  const { error: chaptersErr } = await supabase
    .from('chapters')
    .insert(chaptersToInsert)

  if (chaptersErr) {
    // chapters INSERT 실패 시 고아 books 행 삭제
    // books(senior_id, year, month) unique 제약으로 인해 삭제하지 않으면
    // 이후 모든 재시도가 books INSERT에서 실패하여 복구 불가 상태가 됨
    await supabase.from('books').delete().eq('id', bookId)
    await updateJobStatus(supabase, jobId, 'failed', {
      error_log: `[chaptering] chapters INSERT 실패: ${chaptersErr.message}`,
    })
    return 'failed'
  }

  // books.chapter_count 업데이트
  await supabase
    .from('books')
    .update({ chapter_count: chaptersToInsert.length })
    .eq('id', bookId)

  // book_id를 job에 저장
  await updateJobStatus(supabase, jobId, 'chaptering', {
    book_id: bookId,
    stage_payload: { aggregated_ids: aggregatedIds, book_id: bookId },
  })

  console.log(`[generate-book] job ${jobId} — book ${bookId} 생성 완료 (챕터 ${chaptersToInsert.length}개)`)

  // ── cover_requested: generate-cover 동기 호출 후 결과 확인 ──────────────
  // fire-and-forget이 아닌 응답 확인 방식 — 호출 실패 시 job을 failed로 전환
  await updateJobStatus(supabase, jobId, 'cover_requested', { book_id: bookId })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

    // batch 모드 내부 호출: Authorization 대신 X-Internal-Secret으로 인증
    // INTERNAL_COVER_SECRET는 두 함수 모두에 동일하게 설정된 공유 secret
    // 외부 클라이언트는 이 값을 알 수 없으므로 batch 엔드포인트에 직접 접근 불가
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const internalSecret = Deno.env.get('INTERNAL_COVER_SECRET') ?? ''
    const coverRes = await fetch(`${supabaseUrl}/functions/v1/generate-cover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': callerAuthHeader,  // Supabase 게이트웨이 통과용 (JWT 형식 필요)
        'apikey': anonKey,
        'X-Internal-Secret': internalSecret,
      },
      body: JSON.stringify({ book_id: bookId, senior_id: seniorId, mode: 'batch' }),
    })

    if (!coverRes.ok) {
      const errBody = await coverRes.text().catch(() => '(응답 본문 없음)')
      console.error(`[generate-book] generate-cover 호출 실패 (${coverRes.status}): ${errBody}`)
      await updateJobStatus(supabase, jobId, 'failed', {
        error_log: `generate-cover 호출 실패 (${coverRes.status}): ${errBody}`,
      })
      return 'failed'
    }
  } catch (err) {
    // 네트워크 오류 등 — job을 failed로 전환하여 재시도 가능 상태로 만듦
    console.error(`[generate-book] generate-cover 호출 예외:`, err)
    await updateJobStatus(supabase, jobId, 'failed', {
      error_log: `generate-cover 호출 예외: ${String(err)}`,
    })
    return 'failed'
  }

  // done 전환 및 알림 발송은 generate-cover가 담당
  // generate-cover가 cover_images INSERT 완료 후 job → done + book_draft_ready 알림을 발송함
  console.log(`[generate-book] job ${jobId} — cover_requested 완료, generate-cover에 위임 (senior: ${seniorId})`)
  return 'success'
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization 헤더가 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 호출자 JWT 검증
    // service_role JWT는 auth.getUser()를 통과하지 못하므로 토큰 payload의 role로 분기
    // - role=service_role: 서명 검증 없이 통과 (pg_cron, 내부 호출 전용)
    // - role=authenticated: auth.getUser()로 실제 사용자 세션 검증
    const token = authHeader.replace('Bearer ', '')
    let tokenRole: string | null = null
    try {
      // JWT payload는 URL-safe base64 — '-'/'_' 치환 후 padding 보정 필요
      const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const b64 = raw.padEnd(raw.length + (4 - (raw.length % 4)) % 4, '=')
      const payload = JSON.parse(atob(b64))
      tokenRole = payload.role ?? null
    } catch {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (tokenRole !== 'service_role') {
      // 일반 사용자 토큰은 Supabase Auth로 검증
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      const callerSupabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        anonKey,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { error: authError } = await callerSupabase.auth.getUser()
      if (authError) {
        return new Response(
          JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
          { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    // 인증 통과 후 service_role 클라이언트 사용 (RLS 우회 — 배치 작업용)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    )

    // 요청 본문 파싱 (비어있어도 허용)
    let body: GenerateBookRequest = {}
    try {
      body = await req.json()
    } catch {
      // body 없는 pg_cron 호출도 정상 처리
    }

    // job_id 지정 시: RPC가 생성한 pending job을 이어서 처리 (단일 어르신)
    if (body.job_id) {
      const { data: pendingJob, error: jobFetchErr } = await supabase
        .from('book_generation_jobs')
        .select('id, senior_id, status, stage_payload')
        .eq('id', body.job_id)
        .single()

      if (jobFetchErr || !pendingJob) {
        return new Response(
          JSON.stringify({ error: `job을 찾을 수 없습니다: ${body.job_id}` }),
          { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      if (pendingJob.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: `이미 처리된 job입니다 (status: ${pendingJob.status})` }),
          { status: 409, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      // stage_payload에서 요청된 연/월 복원 (없으면 현재 달 fallback)
      const payload = (pendingJob.stage_payload ?? {}) as { target_year?: number; target_month?: number }
      const now = new Date()
      const jobYear = payload.target_year ?? now.getFullYear()
      const jobMonth = payload.target_month ?? (now.getMonth() + 1)

      const result = await runPipelineForSenior(authHeader, supabase, pendingJob.senior_id, jobYear, jobMonth, pendingJob.id)
      return new Response(
        JSON.stringify({ message: '파이프라인 완료', job_id: body.job_id, result }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 대상 연/월: 현재 날짜 기준
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1  // getMonth()는 0-indexed

    // pg_cron은 28~31일에 모두 실행되므로 "오늘이 이 달의 마지막 날인지" 체크
    // 특정 senior_id 지정(디버그 모드)이면 말일 체크 생략
    if (!body.senior_id) {
      const tomorrow = new Date(now)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth()

      if (!isLastDayOfMonth) {
        return new Response(
          JSON.stringify({ message: '오늘은 월말이 아닙니다, 실행 생략', date: now.toISOString() }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
    }

    // 대상 어르신 목록 조회
    let seniors: SeniorProfile[]

    if (body.senior_id) {
      // 특정 어르신 디버그 모드
      seniors = [{ id: body.senior_id }]
    } else {
      // 전체 어르신 (onboarding_completed = true만)
      const { data, error } = await supabase
        .from('senior_profiles')
        .select('id')
        .eq('onboarding_completed', true)

      if (error) {
        return new Response(
          JSON.stringify({ error: `어르신 목록 조회 실패: ${error.message}` }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      seniors = data ?? []
    }

    if (seniors.length === 0) {
      return new Response(
        JSON.stringify({ message: '처리할 어르신이 없습니다', count: 0 }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[generate-book] ${year}년 ${month}월 — 대상 어르신 ${seniors.length}명`)

    // 어르신별 순차 처리 (LLM 호출 병렬화 시 rate limit 위험)
    let successCount = 0
    let failCount = 0
    let skippedCount = 0

    for (const senior of seniors) {
      try {
        const result = await runPipelineForSenior(authHeader, supabase, senior.id, year, month)
        if (result === 'success') successCount++
        else if (result === 'failed') failCount++
        else skippedCount++
      } catch (err) {
        // 예상치 못한 예외 (네트워크 오류 등)
        failCount++
        console.error(`[generate-book] senior ${senior.id} 파이프라인 예외:`, err)
      }
    }

    return new Response(
      JSON.stringify({
        message: '책 생성 파이프라인 완료',
        year,
        month,
        total: seniors.length,
        success: successCount,
        failed: failCount,
        skipped: skippedCount,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[generate-book] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
