// tts-openai: 텍스트 → AI 음성(MP3) 변환 Edge Function
// OpenAI gpt-4o-mini-tts 사용, voice/speed는 클라이언트가 전달 (매 턴 DB 조회 제거)
// 설계 결정: 서버에서 senior_profiles를 매번 조회하면 대화 1회당 30턴 × 50~100ms 지연 발생
//           → 클라이언트가 마운트 시 1회 로드 후 메모리 캐시로 전달하는 방식 채택

import * as jose from 'npm:jose@5'
import OpenAI from 'npm:openai'

// CORS 헤더 (voice-chat과 동일 패턴)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 허용 voice 목록 (gpt-4o-mini-tts 지원 voice 중 한국어 시니어 친화 선별)
const VALID_VOICES = ['shimmer', 'nova', 'coral', 'onyx', 'echo', 'sage'] as const
// 허용 speed 목록
const VALID_SPEEDS = ['slow', 'normal', 'fast'] as const
// gpt-4o-mini-tts 단일 호출 안전 한도 (chars)
const MAX_TEXT_LENGTH = 4000

type TtsVoice = typeof VALID_VOICES[number]
type TtsSpeed = typeof VALID_SPEEDS[number]

// 어르신 AI 말동무 공통 베이스 instruction
// 모든 voice/speed 조합에 공통 적용 — 따뜻하고 정중한 시니어 친화 톤
const BASE_INSTRUCTION = `You are a warm AI companion for a Korean senior. Use a respectful, familiar, empathetic tone (like a granddaughter or grandson). Speak in Korean with natural prosody. Always validate the senior's emotion before responding.`

// speed별 추가 instruction — gpt-4o-mini-tts는 자연어 instructions로 속도 지정
const SPEED_INSTRUCTIONS: Record<TtsSpeed, string> = {
  slow: 'Speak slowly and clearly for an elderly listener. Pause naturally between sentences.',
  normal: 'Speak at a natural, gentle pace for a senior.',
  fast: 'Speak at a normal conversational pace.',
}

// 요청 본문 타입
interface TtsRequest {
  text: string
  voice: TtsVoice
  speed: TtsSpeed
}

Deno.serve(async (req) => {
  // CORS preflight 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Authorization 헤더 확인
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: '인증 토큰이 필요합니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // JWT 로컬 검증 — getUser()는 DB 왕복이 발생해 50~150ms 추가됨
    // SUPABASE_JWT_SECRET으로 HS256 서명만 검증 (Supabase 빌트인 시크릿)
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET')
    if (!jwtSecret) throw new Error('SUPABASE_JWT_SECRET 환경변수 없음')

    try {
      const secret = new TextEncoder().encode(jwtSecret)
      const { payload } = await jose.jwtVerify(token, secret)
      if (!payload.sub) throw new Error('sub 없음')
    } catch {
      return new Response(
        JSON.stringify({ error: '유효하지 않은 인증 토큰입니다' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 요청 본문 파싱
    let body: TtsRequest
    try {
      body = await req.json()
    } catch {
      return new Response(
        JSON.stringify({ error: '잘못된 요청 형식입니다 (JSON 필요)' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const { text, voice, speed } = body

    // 입력 유효성 검증 (DB CHECK 제약과 별개로 Function 단에서 1차 방어)
    if (!text || typeof text !== 'string' || text.length === 0) {
      return new Response(
        JSON.stringify({ error: 'text가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `텍스트가 너무 깁니다 (최대 ${MAX_TEXT_LENGTH}자)` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    if (!VALID_VOICES.includes(voice as TtsVoice)) {
      return new Response(
        JSON.stringify({ error: `유효하지 않은 voice입니다. 허용값: ${VALID_VOICES.join(', ')}` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    if (!VALID_SPEEDS.includes(speed as TtsSpeed)) {
      return new Response(
        JSON.stringify({ error: `유효하지 않은 speed입니다. 허용값: ${VALID_SPEEDS.join(', ')}` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // OpenAI TTS API 호출
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })
    const instructions = `${BASE_INSTRUCTION} ${SPEED_INSTRUCTIONS[speed]}`

    const audio = await openai.audio.speech.create({
      model: 'gpt-4o-mini-tts',
      voice,
      input: text,
      instructions,
      response_format: 'mp3',
    })

    // MP3 스트림을 클라이언트에 직접 전달 (다운로드 대기 단축)
    return new Response(audio.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
      },
    })

  } catch (error) {
    console.error('[tts-openai] 처리 중 오류:', error)
    const isOpenAiError = error instanceof Error && error.message.includes('OpenAI')
    return new Response(
      JSON.stringify({ error: isOpenAiError ? '음성 생성 서비스에 일시적인 문제가 있어요' : String(error) }),
      { status: isOpenAiError ? 502 : 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
