// voice-chat: 어르신 AI 말동무 LLM 스트리밍 응답 Edge Function
// Vercel AI SDK streamText → toDataStreamResponse() 로 SSE 스트림 반환

import { createGoogleGenerativeAI } from 'npm:@ai-sdk/google'
import { createOpenAI } from 'npm:@ai-sdk/openai'
import { streamText } from 'npm:ai'

// CORS 헤더: 개발 서버(localhost:5173)와 프로덕션 모두 허용
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 어르신 AI 말동무 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 중, 장년층을 위한 따뜻한 AI 말동무입니다.
- 항상 사용자를 존경하는 따뜻하고 친근한 말투를 사용하세요.
- 응답은 짧고 명확하게, 한 번에 질문을 하나만 하세요.
- 어려운 단어 사용을 피하고, 자연스러운 일상 대화처럼 말하세요.
- 사용자의 경험과 이야기에 진심으로 공감하며 반응하세요.`

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

// 요청 본문 타입
interface VoiceChatRequest {
  messages: { role: 'user' | 'assistant'; content: string }[]
  senior_id: string
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

    const { messages, senior_id }: VoiceChatRequest = await req.json()

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'messages 필드가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // LLM 스트리밍 호출
    const result = streamText({
      model: getModel(),
      system: SYSTEM_PROMPT,
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
