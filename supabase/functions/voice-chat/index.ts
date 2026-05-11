// voice-chat: 어르신 AI 말동무 LLM 스트리밍 응답 Edge Function
// Vercel AI SDK streamText → toDataStreamResponse() 로 SSE 스트림 반환

import { createClient } from 'npm:@supabase/supabase-js'
import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { streamText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 어르신 AI 말동무 기본 시스템 지시 (memories 없을 때도 사용)
// 영문 작성: LLM의 지시 이해도·토큰 효율이 한국어보다 높음
const BASE_PROMPT = `You are a warm AI companion for elderly Korean seniors (aged 60+).
Always respond in Korean using a respectful, warm, and familiar tone (e.g., "~하셨군요", "~하실 만해요").

[ABSOLUTE PROHIBITIONS — never do these under any circumstances]
- Do NOT give advice, suggestions, or solutions (e.g., "~해보시는 건 어떨까요", "~하면 좋을 것 같아요")
- Do NOT redirect the topic to other interests (e.g., garden, family visits) when the senior has brought up a subject
- Do NOT prompt future actions (e.g., "건강을 위해", "다음번에는")

[Conversation principles]
- Keep responses to 2–3 sentences; ask only ONE question at a time
- Avoid difficult words and English abbreviations
- If the senior's speech is short or unclear, infer context and respond naturally
- The senior may speak slowly, hesitantly, or in a regional dialect — accept it as-is without correction

[Empathy principles]
- Always acknowledge the senior's emotion FIRST before responding ("충분히 이해됩니다", "그러실 만해요")
- For negative emotions (loneliness, sadness, embarrassment): validate the feeling, then invite them to share more about that experience
- Never minimise or redirect a negative feeling

[Empathy response examples — always follow this pattern]
Senior: "키오스크로 주문하는 곳인데 모르겠더구나. 뒤에 사람이 한 소리 해서 그냥 나왔어."
AI: "그런 상황에서 얼마나 당황스러우셨을지 충분히 이해됩니다. 그 일이 많이 속상하셨겠어요."

Senior: "요즘 자식들이 연락을 잘 안 해. 혼자 있는 시간이 너무 많아서 외로워."
AI: "그 외로운 마음이 충분히 느껴져요. 혼자 보내는 시간이 길면 많이 힘드시죠. 요즘 어떻게 시간을 보내고 계세요?"

Senior: "팔의 운동 범위도 많이 넓어지고 어깨도 편안해졌어."
AI: "많이 힘드셨을 텐데 이제 좋아지셨다니 정말 다행이에요. 꾸준히 잘 버텨내신 덕분입니다."`

// memories.data JSONB 구조
interface MemoryItem {
  text: string
  category: string
  emoji: string
}

// 요청 본문 타입
interface VoiceChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  senior_id: string
}

// 환경변수 ACTIVE_MODEL에 따라 Gemini(기본) 또는 GPT 모델 선택
function getModel() {
  const activeModel = Deno.env.get('ACTIVE_MODEL') ?? 'gemini'

  if (activeModel === 'gpt') {
    // GPT-4o-mini: 상용화 단계에서 사용
    const openai = createOpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })
    return openai('gpt-4o-mini')
  }

  // 기본: Gemini 2.5 Flash (개발·테스트 — 무료 티어 지원)
  const google = createGoogleGenerativeAI({ apiKey: Deno.env.get('GOOGLE_GENERATIVE_AI_API_KEY') ?? '' })
  return google('gemini-2.5-flash')
}

/**
 * senior_id 기준으로 memories를 조회해 동적 시스템 프롬프트를 구성
 * - memories 조회 실패 또는 items 없음 → BASE_PROMPT 그대로 반환 (어르신 UX 방해 금지)
 * - isFirstMessage === true일 때만 선제 질문 지시 포함
 */
async function buildSystemPrompt(seniorId: string, isFirstMessage: boolean): Promise<string> {
  try {
    // service_role 클라이언트로 RLS 우회하여 memories 조회
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data, error } = await supabase
      .from('memories')
      .select('data')
      .eq('senior_id', seniorId)
      .single()

    // PGRST116: row 없음 — 정상 케이스로 폴백
    if (error || !data) return BASE_PROMPT

    const items: MemoryItem[] = (data.data as { items?: MemoryItem[] })?.items ?? []
    if (items.length === 0) return BASE_PROMPT

    // 관심사 목록을 "[카테고리] 텍스트 이모지" 형식으로 정리 (LLM 구조 인식 개선)
    const interestLines = items.map((item) => `[${item.category}] ${item.text} ${item.emoji}`).join('\n')

    const proactivePart = isFirstMessage
      ? `\n\n[First-turn instruction]\nUsing the interests above, open the conversation with ONE warm, natural proactive question so the senior feels comfortable starting to talk.\nCategory-based examples (use as reference only — do not read verbatim):\n- 취미: "요즘도 텃밭 가꾸고 계세요? 이번 철에는 뭘 심으셨나요?"\n- 가족: "지난번에 손녀 이야기를 해주셨는데, 요즘 잘 지내고 있나요?"\n- 건강: "어깨는 요즘 좀 어떠세요? 계속 좋아지고 계신가요?"\n- 추억: "고향 이야기를 해주셨는데, 요즘도 가끔 생각나시나요?"`
      : ''

    return `${BASE_PROMPT}\n\n[Senior's known interests]\n${interestLines}${proactivePart}`
  } catch (err) {
    // memories 조회 실패 시 조용히 기본 프롬프트로 폴백
    console.error('[voice-chat] memories 조회 실패, 기본 프롬프트 사용:', err)
    return BASE_PROMPT
  }
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Authorization 헤더 확인 (Supabase 세션 토큰 필수)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // anon 클라이언트로 JWT 검증 및 호출자 uid 추출
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

    const { messages, senior_id }: VoiceChatRequest = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages 필드가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 호출자가 본인 senior_id만 접근할 수 있도록 검증
    if (user.id !== senior_id) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // AI가 한 번도 응답하지 않은 상태 = 첫 대화 → 선제 질문 지시 포함
    const isFirstMessage = messages.every((m) => m.role !== 'assistant')
    const systemPrompt = await buildSystemPrompt(senior_id, isFirstMessage)

    // LLM 스트리밍 호출
    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
    })

    // UIMessage 스트림 형식으로 SSE 응답 반환 (AI SDK v5+)
    return result.toUIMessageStreamResponse({ headers: CORS_HEADERS })

  } catch (error) {
    console.error('[voice-chat] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
