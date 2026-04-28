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

    const systemPrompt = `당신은 어르신과의 대화에서 기억할 만한 정보를 추출하는 분석가입니다.

규칙:
1. 기존 기억에 이미 있는 내용은 절대 포함하지 마세요.
2. 새로 발견된 정보만 추출하세요.
3. 응답은 반드시 순수 JSON 배열만 (마크다운 코드블록, 설명 텍스트 금지).
4. 추출할 정보가 없으면 빈 배열 [] 반환.
5. 각 항목은 { "text": "...", "category": "...", "emoji": "..." } 형식.

카테고리 안내 (아래 중에서 선택하되, 맞는 게 없으면 새로 만들어도 됩니다):
취미, 가족, 건강, 일상, 추억, 가치관, 일정

날짜·일정이 언급된 경우 text에 날짜 정보를 함께 포함하세요.
예: "손녀 졸업식 (5월 15일)" → category: "일정", emoji: "📅"

이모지는 카테고리와 내용에 맞게 자유롭게 선택하세요.

[기존 기억]
${existingJson}

[어르신 발화]
${utteranceTexts}

[응답 형식]
[{"text": "텃밭 가꾸기를 좋아함", "category": "취미", "emoji": "🌱"}, ...]`

    // LLM 실패 시 upsert를 진행하지 않고 즉시 실패 반환
    let extractedItems: MemoryItem[]
    try {
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: systemPrompt,
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
