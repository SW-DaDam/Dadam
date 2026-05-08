// extract-memory: 세션 종료 후 어르신 발화 → LLM 분석 → memories.data JSONB 병합 갱신
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { generateText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// memories.data JSONB — items 플랫 배열 구조
interface MemoryItem {
  text: string
  category: string  // LLM이 자유롭게 결정
  emoji: string
}

interface MemoryData {
  items?: MemoryItem[]
}

// 요청 본문 타입
interface ExtractMemoryRequest {
  conversation_id: string
  senior_id: string
}

/**
 * 기존 items와 LLM 추출 결과를 병합
 * - text 기준으로 중복 제거 (대소문자·공백 정규화 후 비교)
 * - 신규 항목만 기존 배열 뒤에 추가
 */
function mergeItems(existing: MemoryItem[], extracted: MemoryItem[]): MemoryItem[] {
  const normalizeText = (t: string) => t.trim().toLowerCase()
  const existingTexts = new Set(existing.map((i) => normalizeText(i.text)))

  const newItems = extracted.filter(
    (item) => item.text && !existingTexts.has(normalizeText(item.text)),
  )

  return [...existing, ...newItems]
}

serve(async (req) => {
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

    // anon 클라이언트로 JWT를 검증하고 호출자 uid 추출
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
    const body = await req.json() as Partial<ExtractMemoryRequest>
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

    // DB 작업용 service_role 클라이언트 (RLS 우회 — utterances 직접 조회 필요)
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

    // 어르신 발화만 조회 (speaker = 'senior')
    const { data: utterances, error: uttErr } = await supabase
      .from('utterances')
      .select('content, sequence_number')
      .eq('conversation_id', conversation_id)
      .eq('speaker', 'senior')
      .order('sequence_number', { ascending: true })

    if (uttErr) {
      console.error('[extract-memory] utterances 조회 실패', uttErr)
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

    // 기존 memories.data 조회
    const { data: memoryRow, error: memErr } = await supabase
      .from('memories')
      .select('data')
      .eq('senior_id', senior_id)
      .single()

    if (memErr && memErr.code !== 'PGRST116') {
      console.error('[extract-memory] memories 조회 실패', memErr)
      return new Response(
        JSON.stringify({ success: false, error: memErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const existingItems: MemoryItem[] = ((memoryRow?.data as MemoryData)?.items) ?? []

    // LLM 호출로 새 메모리 항목 추출
    const utteranceTexts = utterances.map((u) => u.content).join('\n')
    const existingJson = JSON.stringify(existingItems, null, 2)

    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })

    // 영문 system prompt: LLM의 지시 이해도·토큰 효율이 한국어보다 높음
    // 앞으로 이 파일에 추가하는 프롬프트도 반드시 영문으로 작성할 것
    const systemPrompt = `You are an analyst that extracts memorable facts from a Korean elderly senior's conversation utterances.

[Rules]
1. Never include anything already present in the existing memories.
2. Extract only newly discovered information.
3. Respond with a pure JSON array only — no markdown code blocks, no explanatory text.
4. If there is nothing to extract, return an empty array [].
5. Each item must follow this format: { "text": "...", "category": "...", "emoji": "..." }

[Filtering rules — do NOT extract these]
- Simple affirmations or back-channels: "네", "그렇군요", "맞아요", "그래요"
- Utterances that contain only a bare yes/no with no concrete information

[text writing rules — very important]
- Write in short noun-form or predicative endings. Do not write long run-on sentences.
  Good: "수빈이는 자주 못 온다", "텃밭 가꾸기를 좋아함", "무릎이 안 좋아서 병원 다님"
  Bad:  "수빈이는 자주 못 와서 혼자 먹어야지", "텃밭에서 토마토를 키우고 있어서 수확했어"
- If a fact being extracted involves a person already in existing memories with a known relationship, include that relationship in the text.
  Example: existing memory has "딸 수빈이" → new utterance "수빈이가 이사했어" → extract as "딸 수빈이가 이사함"
- Do NOT re-extract a fact already in existing memories by merely rephrasing the relationship (duplicate prevention).
- For a new person not in existing memories, use only their name — do NOT infer or add a relationship.
  Example: first mention of "민준이" → "민준이가 도움을 줌" (no relationship label)
- Relationships include not only family (딸, 아들, 손자, 며느리) but also friends, juniors, neighbours, classmates, etc.

[Emoji rules]
- Use exactly ONE emoji per item.

[Categories — prefer these 7; create a new 2–4 character Korean word only if none fit]
취미, 가족, 건강, 일상, 추억, 가치관, 일정

If a date or scheduled event is mentioned, include the date in the text.
Example: "손녀 졸업식 (5월 15일)" → category: "일정", emoji: "📅"

[Few-shot examples]
Utterance: "이웃들이랑 모여서 얘기하는 게 참 좋아요. 치매 예방도 되고"
→ {"text": "이웃들과 모여 담소 나누기를 좋아함", "category": "일상", "emoji": "😊"}

Utterance: "사위가 같이 가자고 해서 딸네 휴가에 같이 갔다 왔어요"
→ {"text": "사위 초대로 딸네 가족 휴가에 동참", "category": "가족", "emoji": "👨‍👩‍👧"}

Utterance: "꽃 선물 받는 게 가장 좋죠. 어릴 때는 진달래, 개나리 많이 꺾었어"
→ {"text": "꽃 선물 받는 것을 가장 좋아함", "category": "취미", "emoji": "🌸"}

[Existing memories]
${existingJson}

[Senior's utterances]
${utteranceTexts}

[Response format]
[{"text": "텃밭 가꾸기를 좋아함", "category": "취미", "emoji": "🌱"}, ...]`

    // LLM 실패 시 upsert를 진행하지 않고 즉시 실패 반환
    let extractedItems: MemoryItem[]
    try {
      // system role로 분리하여 지시 명확성 향상
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Extract memorable facts from the senior utterances provided in the system prompt.' },
        ],
        temperature: 0.3,
      })
      extractedItems = JSON.parse(text.trim()) as MemoryItem[]
      if (!Array.isArray(extractedItems)) extractedItems = []
    } catch (llmErr) {
      console.error('[extract-memory] LLM 호출 또는 JSON 파싱 실패', llmErr)
      return new Response(
        JSON.stringify({ success: false, error: 'LLM 추출 실패 — 기존 memories 보존됨' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 기존 items와 LLM 결과 병합 (text 기준 중복 제거)
    const mergedItems = mergeItems(existingItems, extractedItems)

    // memories 테이블 UPSERT (최초 대화 시 row가 없을 수 있음)
    const { error: upsertErr } = await supabase
      .from('memories')
      .upsert(
        {
          senior_id,
          data: { items: mergedItems },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'senior_id' },
      )

    if (upsertErr) {
      console.error('[extract-memory] memories upsert 실패', upsertErr)
      return new Response(
        JSON.stringify({ success: false, error: upsertErr.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // conversations.memory_extracted = true 업데이트
    await supabase
      .from('conversations')
      .update({ memory_extracted: true })
      .eq('id', conversation_id)

    return new Response(
      JSON.stringify({ success: true, added_count: extractedItems.length }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[extract-memory] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
