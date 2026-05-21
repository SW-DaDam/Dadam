// tag-utterances: 세션 종료 후 어르신 발화 → LLM 분류 → utterances.tags 배열 UPDATE
import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { generateText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ERD utterance_tag Enum과 동일
type UtteranceTag = 'daily_mundane' | 'memory_recall' | 'emotional_peak' | 'philosophy' | 'relationship_event'

interface TagUtterancesRequest {
  conversation_id: string
  senior_id: string
}

interface TagResult {
  id: string
  tags: UtteranceTag[]
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Authorization 헤더 검증
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // anon 클라이언트로 JWT 검증 및 호출자 uid 추출 (extract-memory 패턴 동일)
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 요청 본문 파싱
    const body = await req.json() as Partial<TagUtterancesRequest>
    const { conversation_id, senior_id } = body

    if (!conversation_id || !senior_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id, senior_id 필드가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 호출자가 본인 senior_id만 처리할 수 있도록 검증
    if (user.id !== senior_id) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // DB 작업용 service_role 클라이언트 (RLS 우회 — utterances 직접 조회·갱신 필요)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // conversation이 인증된 senior 소유인지 검증 (service_role이 RLS 우회하므로 명시적 확인)
    const { data: conversation, error: convErr } = await supabase
      .from('conversations')
      .select('senior_id')
      .eq('id', conversation_id)
      .single()

    if (convErr || !conversation) {
      return new Response(
        JSON.stringify({ error: '대화를 찾을 수 없습니다' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (conversation.senior_id !== senior_id) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 어르신 발화만 조회 (speaker = 'senior', sequence_number 오름차순)
    const { data: utterances, error: uttErr } = await supabase
      .from('utterances')
      .select('id, content, sequence_number')
      .eq('conversation_id', conversation_id)
      .eq('speaker', 'senior')
      .order('sequence_number', { ascending: true })

    if (uttErr) {
      console.error('[tag-utterances] utterances 조회 실패', uttErr)
      return new Response(
        JSON.stringify({ success: false, error: uttErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 발화가 없으면 early return
    if (!utterances || utterances.length === 0) {
      return new Response(
        JSON.stringify({ success: true, skipped: true }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // LLM 프롬프트 구성: id + content 쌍 목록
    const utteranceList = utterances
      .map((u) => `{"id": "${u.id}", "content": "${u.content.replace(/"/g, '\\"')}"}`)
      .join('\n')

    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    // 영문 system prompt: LLM의 지시 이해도·토큰 효율이 한국어보다 높음
    // 앞으로 이 파일에 추가하는 프롬프트도 반드시 영문으로 작성할 것
    const systemPrompt = `You are a classifier that assigns emotion/topic tags to Korean elderly senior utterances.

[Tag definitions — multiple tags allowed per utterance]
- daily_mundane: Ordinary small talk (weather, meals, TV, etc.). Assign even if mild emotion is present, as long as it is low-intensity or purely situational.
- memory_recall: Recollection of past memories. Assign when explicit past-tense markers appear (어릴 때, 옛날에, 그 시절) OR when the utterance clearly describes a past event/experience even without those markers.
- emotional_peak: Currently intense emotional expression at the moment of speaking. Assign ONLY when strong present-emotion keywords appear (e.g., 너무 외로워, 눈물 나, 충격받았어, 죄책감이 들어). Do NOT assign for past-event descriptions or mild complaints.
- philosophy: Life values, beliefs, or lessons (살다 보면, 중요한 건, 그래야 해).
- relationship_event: A concrete event involving family or acquaintances (손자가 ..., 며느리가 ..., 이웃이 ...). Simple mentions without an event do NOT qualify.

[Compound tag rules]
- Multiple tags may be assigned simultaneously (e.g., memory_recall + emotional_peak).
- The tag "general" does not exist — never use it.
- An empty array [] is valid when no tag applies.

[Few-shot examples]
Utterance: "다들 바빠서 만나기 힘들어하니 혼자 보내는 시간이 너무 외로워."
Tags: ["emotional_peak"]
Reason: "너무 외로워" — strong present-emotion keyword is explicit.

Utterance: "학교에서 애들이 나를 때리는데 아무것도 할 수 없어서 슬펐어."
Tags: ["memory_recall"]
Reason: Past-tense experience narration — qualifies as memory_recall even without explicit past-time marker.

Utterance: "오늘 점심에 된장찌개 끓여 먹었어요."
Tags: ["daily_mundane"]
Reason: Present-day routine description; no emotion, memory, or relationship event.

Utterance: "예전 집 앞이 다 들판이었는데, 그 시절이 그립고 지금은 참 슬프구나."
Tags: ["memory_recall", "emotional_peak"]
Reason: Past recollection + strong present sadness coexist.

Utterance: "모두가 손해 보는 일은 안 하려고만 해. 그게 화가 나."
Tags: ["daily_mundane"]
Reason: Situational complaint with low emotional intensity — does not meet emotional_peak threshold.

[Response format — pure JSON array only, no explanatory text]
[
  { "id": "uuid", "tags": ["memory_recall", "emotional_peak"] },
  { "id": "uuid", "tags": ["daily_mundane"] }
]`

    const userMessage = `Classify the following utterances:\n${utteranceList}`

    // LLM 실패 시 utterances 원본 보존 후 즉시 실패 반환
    let tagResults: TagResult[]
    try {
      // system role로 분리하여 지시 명확성 향상
      const { text } = await generateText({
        model: openai('gpt-5.4-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
      })
      tagResults = JSON.parse(text.trim()) as TagResult[]
      if (!Array.isArray(tagResults)) tagResults = []
    } catch (llmErr) {
      console.error('[tag-utterances] LLM 호출 또는 JSON 파싱 실패', llmErr)
      return new Response(
        JSON.stringify({ success: false, error: 'LLM 분류 실패 — utterances 원본 보존됨' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // LLM이 반환한 ID 중 이 conversation에서 조회한 것만 허용 (할루시네이션 방지)
    const validIds = new Set(utterances.map((u) => u.id))
    const safeResults = tagResults.filter(({ id }) => validIds.has(id))

    // utterances batch UPDATE: 개별 실패 허용 (Promise.allSettled)
    const updateResults = await Promise.allSettled(
      safeResults.map(({ id, tags }) =>
        supabase.from('utterances').update({ tags }).eq('id', id)
      ),
    )

    // rejected(네트워크 오류 등) + fulfilled이지만 DB error 모두 로그
    let successCount = 0
    updateResults.forEach((result, idx) => {
      if (result.status === 'rejected') {
        console.error(`[tag-utterances] utterance ${safeResults[idx].id} UPDATE 실패`, result.reason)
      } else if (result.value.error) {
        console.error(`[tag-utterances] utterance ${safeResults[idx].id} DB 에러`, result.value.error)
      } else {
        successCount++
      }
    })

    return new Response(
      JSON.stringify({ success: true, tagged_count: successCount }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[tag-utterances] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
