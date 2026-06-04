// discover-short-book-topics: 단편 책 주제 후보 발견 Edge Function
// 어르신의 모든 미사용 PRIORITY_TAG 발화를 LLM으로 크로스-월 클러스터링
// 반환: 최대 5개 주제 후보 [{title, summary, date_range, utterance_ids, sample_quote}]

import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { generateText } from 'npm:ai'

// CORS 헤더: 프론트엔드에서 직접 호출
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 단편 책 후보 발화 선별 기준 태그 (generate-book과 동일)
const PRIORITY_TAGS = ['emotional_peak', 'memory_recall', 'philosophy', 'relationship_event']

// 발화 수집 상한 (gpt-4o 토큰 예산: ~4,000 토큰)
const MAX_UTTERANCES = 120

// content truncate 기준 (100자 이상이면 의미 손실 없이 압축 가능)
const CONTENT_TRUNCATE_LEN = 100

// 요청 본문 타입
interface DiscoverTopicsRequest {
  senior_id: string
}

// LLM이 반환하는 주제 후보 타입
interface TopicCandidate {
  title: string
  summary: string
  date_range: string
  utterance_ids: string[]
  sample_quote: string
}

// LLM에 전달할 발화 항목 (날짜 포함 — 크로스-월 클러스터링 기준)
interface UtteranceForDiscovery {
  id: string
  content: string
  date: string  // YYYY-MM-DD 형식
}

// 크로스-월 주제 발견 시스템 프롬프트
// - PRIORITY_TAG 발화들을 반복 주제 기준으로 클러스터링
// - 최소 2개 날짜, 최소 3개 발화가 있어야 주제로 인정
const TOPIC_DISCOVERY_SYSTEM_PROMPT = `You are analyzing utterances from a Korean senior's conversations to find short book topics.

Find recurring themes that appear across MULTIPLE dates — topics the senior returns to repeatedly
(fishing, wartime memories, hometown, grandchildren, specific hobbies, etc.).

Each input utterance has: id, content (truncated to 100 chars), and date (YYYY-MM-DD).

Requirements per topic cluster:
- Must span at least 2 different dates
- Must contain at least 3 utterances
- Must be narratively coherent — the selected utterances could form a single short story
- Exclude pure daily chatter (meals/weather) unless emotionally significant

Return at most 5 topic clusters, ordered by narrative strength (most compelling first).
Return ONLY valid JSON — no markdown code blocks, no explanatory text:
[
  {
    "title": "string (10-20 Korean characters, evocative)",
    "summary": "string (40-80 Korean characters, what stories are in this cluster)",
    "date_range": "YYYY.MM ~ YYYY.MM",
    "utterance_ids": ["uuid", "..."],
    "sample_quote": "string (most evocative snippet from the utterances, max 50 chars)"
  }
]

If no qualifying topics are found, return an empty array: []`

/**
 * JWT payload에서 role과 sub(uid) 추출
 * URL-safe base64 디코딩 필요 ('+'→'-', '/'→'_' 역치환 + padding 보정)
 */
function decodeJwtPayload(token: string): { role?: string; sub?: string } | null {
  try {
    const raw = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const b64 = raw.padEnd(raw.length + (4 - (raw.length % 4)) % 4, '=')
    return JSON.parse(atob(b64))
  } catch {
    return null
  }
}

/**
 * 어르신의 미사용 PRIORITY_TAG 발화 수집 (2단계 쿼리)
 * 1단계: senior_id → conversation_id 목록 (전체 기간, 월 필터 없음)
 * 2단계: utterances — speaker=senior, PRIORITY_TAGS overlap, used_in_short_book_id IS NULL
 * generate-book의 aggregateUtterances 패턴 동일, 월 필터 제거 + 전체 기간 대상
 */
async function collectCandidateUtterances(
  supabase: ReturnType<typeof createClient>,
  seniorId: string,
): Promise<UtteranceForDiscovery[]> {
  // 1단계: 해당 어르신의 모든 conversation_id 조회
  const { data: conversations, error: convErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('senior_id', seniorId)
    .order('started_at', { ascending: true })

  if (convErr) throw new Error(`conversations 조회 실패: ${convErr.message}`)

  const conversationIds = (conversations ?? []).map((c: { id: string }) => c.id)
  if (conversationIds.length === 0) return []

  // 2단계: PRIORITY_TAG 발화 조회
  // used_in_short_book_id IS NULL — 이미 단편에 사용된 발화 제외
  // overlaps() — PRIORITY_TAGS 중 하나라도 포함한 발화만 (&&  연산자)
  const { data: utterances, error: uttErr } = await supabase
    .from('utterances')
    .select('id, content, tags, created_at')
    .eq('speaker', 'senior')
    .in('conversation_id', conversationIds)
    .overlaps('tags', PRIORITY_TAGS)        // tags && ARRAY[...] 조건
    .is('used_in_short_book_id', null)     // 단편에 사용된 발화 제외
    .is('used_in_monthly_book_id', null)   // 월간 책에 사용된 발화 제외
    .order('created_at', { ascending: true })
    .limit(MAX_UTTERANCES)

  if (uttErr) throw new Error(`utterances 조회 실패: ${uttErr.message}`)

  return (utterances ?? []).map((u: {
    id: string
    content: string
    created_at: string
  }) => ({
    id: u.id,
    // content truncate: 100자 초과분은 LLM 토큰 낭비 → 잘라냄
    content: u.content.length > CONTENT_TRUNCATE_LEN
      ? u.content.slice(0, CONTENT_TRUNCATE_LEN) + '…'
      : u.content,
    date: u.created_at.slice(0, 10),  // YYYY-MM-DD만 추출
  }))
}

/**
 * JSON 추출 헬퍼 — LLM이 ```json ... ``` 마크다운 블록으로 감싸더라도 파싱
 * generate-book/index.ts의 extractJson 패턴 동일
 */
function extractJsonArray(raw: string): TopicCandidate[] | null {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  try {
    const parsed = JSON.parse(stripped)
    return Array.isArray(parsed) ? (parsed as TopicCandidate[]) : null
  } catch {
    return null
  }
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

    // JWT 검증: 일반 사용자(authenticated)만 허용 — service_role 배치 호출 없음
    const token = authHeader.replace('Bearer ', '')
    const jwtPayload = decodeJwtPayload(token)
    if (!jwtPayload) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // service_role은 이 함수에서 허용하지 않음 (개인 데이터 조회 전용)
    if (jwtPayload.role === 'service_role') {
      return new Response(
        JSON.stringify({ error: '사용자 토큰이 필요합니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 사용자 세션 검증 (Supabase Auth)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const callerSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      anonKey,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await callerSupabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 요청 본문 파싱
    let body: DiscoverTopicsRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: '요청 본문을 파싱할 수 없습니다' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (!body.senior_id) {
      return new Response(
        JSON.stringify({ error: 'senior_id가 필요합니다' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 본인 데이터만 조회 허용 (uid !== senior_id 이면 403)
    if (user.id !== body.senior_id) {
      return new Response(
        JSON.stringify({ error: '본인의 데이터만 조회할 수 있습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 인증 통과 후 service_role 클라이언트 사용 (RLS 우회 — 조회 전용)
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey,
    )

    const seniorId = body.senior_id

    // 미사용 PRIORITY_TAG 발화 수집
    let candidateUtterances: UtteranceForDiscovery[]
    try {
      candidateUtterances = await collectCandidateUtterances(supabase, seniorId)
    } catch (err) {
      console.error(`[discover-short-book-topics] 발화 조회 실패 (senior: ${seniorId}):`, err)
      return new Response(
        JSON.stringify({ error: `발화 조회 실패: ${String(err)}` }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 클러스터링 최소 조건(3건) 미만이면 빈 배열 즉시 반환
    if (candidateUtterances.length < 3) {
      console.log(`[discover-short-book-topics] 발화 ${candidateUtterances.length}건 — 최소 기준 미달, 빈 배열 반환`)
      return new Response(
        JSON.stringify({ topics: [] }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[discover-short-book-topics] senior ${seniorId} — 발화 ${candidateUtterances.length}건으로 주제 분석 시작`)

    // LLM 호출용 발화 목록 직렬화 (JSON 1줄씩)
    const utteranceLines = candidateUtterances
      .map((u) => JSON.stringify({ id: u.id, content: u.content, date: u.date }))
      .join('\n')

    // gpt-4o로 크로스-월 주제 클러스터링
    // temperature 0.3: 분류·클러스터링 작업이므로 창의성보다 일관성 우선
    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    const callLLM = () => generateText({
      model: openai('gpt-5.4-mini'),
      messages: [
        { role: 'system', content: TOPIC_DISCOVERY_SYSTEM_PROMPT },
        { role: 'user', content: `Analyze the following senior utterances and find recurring themes:\n${utteranceLines}` },
      ],
      temperature: 0.3,
    })

    let topics: TopicCandidate[]
    try {
      const result = await callLLM()
      let parsed = extractJsonArray(result.text)

      // JSON 파싱 실패 시 1회 재시도 (generate-book 패턴 동일)
      if (!parsed) {
        console.warn(`[discover-short-book-topics] JSON 파싱 실패, 1회 재시도`)
        const retry = await callLLM()
        parsed = extractJsonArray(retry.text)
        if (!parsed) throw new Error('JSON 파싱 재시도 실패')
      }

      topics = parsed
    } catch (err) {
      console.error(`[discover-short-book-topics] LLM 호출 실패 (senior: ${seniorId}):`, err)
      return new Response(
        JSON.stringify({ error: `주제 분석 실패: ${String(err)}` }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log(`[discover-short-book-topics] senior ${seniorId} — 주제 ${topics.length}개 발견`)

    return new Response(
      JSON.stringify({ topics }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[discover-short-book-topics] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
