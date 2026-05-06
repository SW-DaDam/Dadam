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

필터링 규칙 (추출하지 않는 발화):
- "네", "그렇군요", "맞아요", "그래요" 등 단순 호응·맞장구
- 질문에 대한 단순 긍정·부정만 있는 발화 (구체적 정보 없음)

text 작성 규칙 (매우 중요):
- 반드시 짧은 명사형·서술형 종결로 작성하세요. 문장을 길게 이어 쓰지 마세요.
  좋은 예: "수빈이는 자주 못 온다", "텃밭 가꾸기를 좋아함", "무릎이 안 좋아서 병원 다님"
  나쁜 예: "수빈이는 자주 못 와서 혼자 먹어야지", "텃밭에서 토마토를 키우고 있어서 수확했어"
- 이번 대화에서 처음 등장하는 사실을 추출할 때, 기존 기억에 해당 인물의 관계가 명시되어 있으면 관계를 함께 표기하세요.
  예: 기존 기억에 "딸 수빈이"가 있고 발화에 "수빈이가 이사했어"가 나오면 → "딸 수빈이가 이사함"
- 기존 기억에 이미 있는 사실을 관계 표현만 달리해서 재추출하지 마세요 (중복 방지).
- 기존 기억에 없는 신규 인물은 이름만 표기하고 관계를 추측하지 마세요.
  예: 처음 등장한 "민준이" → "민준이가 도움을 줌" (관계 추가 금지)
- 관계는 가족(딸, 아들, 손자, 며느리 등)뿐 아니라 친구, 후배, 이웃, 동창 등도 포함합니다.

이모지 규칙:
- 이모지는 항목당 반드시 1개만 사용하세요.

카테고리 (아래 7개를 우선 사용, 맞는 게 없을 때만 2~4자 한국어 단어로 새로 만드세요):
취미, 가족, 건강, 일상, 추억, 가치관, 일정

날짜·일정이 언급된 경우 text에 날짜 정보를 함께 포함하세요.
예: "손녀 졸업식 (5월 15일)" → category: "일정", emoji: "📅"

few-shot 예시:
발화: "이웃들이랑 모여서 얘기하는 게 참 좋아요. 치매 예방도 되고"
→ {"text": "이웃들과 모여 담소 나누기를 좋아함", "category": "일상", "emoji": "😊"}

발화: "사위가 같이 가자고 해서 딸네 휴가에 같이 갔다 왔어요"
→ {"text": "사위 초대로 딸네 가족 휴가에 동참", "category": "가족", "emoji": "👨‍👩‍👧"}

발화: "꽃 선물 받는 게 가장 좋죠. 어릴 때는 진달래, 개나리 많이 꺾었어"
→ {"text": "꽃 선물 받는 것을 가장 좋아함", "category": "취미", "emoji": "🌸"}

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
