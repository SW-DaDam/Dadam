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
const BASE_PROMPT = `당신은 중, 장년층을 위한 따뜻한 AI 말동무입니다.
- 항상 사용자를 존경하는 따뜻하고 친근한 말투를 사용하세요.
- 응답은 짧고 명확하게, 한 번에 질문을 하나만 하세요.
- 어려운 단어 사용을 피하고, 자연스러운 일상 대화처럼 말하세요.
- 사용자의 경험과 이야기에 진심으로 공감하며 반응하세요.`

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

    // 관심사 목록을 "카테고리: 텍스트 이모지" 형식으로 정리
    const interestLines = items.map((item) => `- ${item.category}: ${item.text} ${item.emoji}`).join('\n')

    const proactivePart = isFirstMessage
      ? `\n\n[첫 대화 시작 지시]\n위 관심사를 참고하여 어르신이 편안하게 이야기를 시작할 수 있도록\n자연스럽고 따뜻한 선제 질문으로 대화를 시작해 주세요.\n예: "지난번에 텃밭 토마토 이야기를 해주셨는데, 요즘은 어떻게 지내고 계세요?"`
      : ''

    return `${BASE_PROMPT}\n\n[어르신 관심사 정보]\n${interestLines}${proactivePart}`
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
