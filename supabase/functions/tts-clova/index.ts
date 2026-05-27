// tts-clova: 텍스트 → AI 음성(MP3) 변환 Edge Function
// Naver Clova Voice Premium API 사용 — voice/speed는 클라이언트가 전달 (매 턴 DB 조회 제거)
//
// 음성 응답 지연 최소화 설계:
// 1. JWT 로컬 검증 (jose ES256 + JWKS 캐싱) — getUser() DB 왕복 50~150ms 제거
//    Supabase 신규 프로젝트는 비대칭 키(ES256)로 access token을 서명. JWKS endpoint
//    에서 공개키를 가져와 검증하며, 공개키는 모듈 레벨에서 캐싱되므로 첫 호출 외엔
//    추가 네트워크 왕복이 없음.
// 2. Clova fetch().body(ReadableStream)를 그대로 Response body로 패스스루 — first-byte 빠름
// 3. 입력 검증을 Function 단에서 1차 방어 — DB CHECK 도달 전 조기 반환

import * as jose from 'npm:jose@5'

// CORS 헤더 (voice-chat·stt-whisper와 동일 패턴)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Clova Voice Premium TTS API 엔드포인트
const CLOVA_TTS_ENDPOINT = 'https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts'

// Supabase JWT 검증용 JWKS 설정
// SUPABASE_URL은 Edge Function 런타임에 자동 주입되는 빌트인 환경변수
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const JWT_ISSUER = `${SUPABASE_URL}/auth/v1`
const JWT_AUDIENCE = 'authenticated'
// JWKS는 모듈 스코프에서 1회 생성 → 공개키가 자동 캐싱되어 매 호출마다 fetch 안 함
const JWKS = jose.createRemoteJWKSet(new URL(`${JWT_ISSUER}/.well-known/jwks.json`))

// 허용 speaker 목록 — 여성: nyejin/noyj/vara, 남성: nminsang/nsiyoon/vian
const VALID_SPEAKERS = ['nyejin', 'noyj', 'vara', 'nminsang', 'nsiyoon', 'vian'] as const
// 허용 speed 목록 (DB enum과 동일)
const VALID_SPEEDS = ['slow', 'normal', 'fast'] as const

// Clova speed 매핑 — 음수=빠름 / 0=정상 / 양수=느림 (OpenAI 반대 방향)
// 실청취 기준: slow +2(살짝 느림), normal 0(기본), fast -2(약간 빠름)
const CLOVA_SPEED_MAP: Record<TtsSpeed, number> = {
  slow: 2,
  normal: 0,
  fast: -2,
}

// Clova 1회 호출 한도 2,000자 — 안전 마진 100자
const MAX_TEXT_LENGTH = 1900

// Clova 응답 타임아웃 — 정상 단문 TTS는 1초 미만이라 10초면 충분히 보수적
// Clova가 stall될 경우 무한 대기로 Edge Function concurrency 슬롯이 묶이는 것을 방지
const CLOVA_TIMEOUT_MS = 10_000

type TtsVoice = typeof VALID_SPEAKERS[number]
type TtsSpeed = typeof VALID_SPEEDS[number]

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

    // JWT 로컬 검증 — getUser() DB 왕복 회피 (음성 응답 지연 최소화 핵심)
    // JWKS는 모듈 스코프에서 캐싱되므로 매 호출마다 fetch 없음
    const token = authHeader.replace(/^Bearer\s+/i, '')

    try {
      const { payload } = await jose.jwtVerify(token, JWKS, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
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

    // 입력 유효성 검증
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
    if (!VALID_SPEAKERS.includes(voice as TtsVoice)) {
      return new Response(
        JSON.stringify({ error: `유효하지 않은 voice입니다. 허용값: ${VALID_SPEAKERS.join(', ')}` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    if (!VALID_SPEEDS.includes(speed as TtsSpeed)) {
      return new Response(
        JSON.stringify({ error: `유효하지 않은 speed입니다. 허용값: ${VALID_SPEEDS.join(', ')}` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Clova 인증 키 (NCP 콘솔 발급)
    const clientId = Deno.env.get('NCP_CLOVA_CLIENT_ID')
    const clientSecret = Deno.env.get('NCP_CLOVA_CLIENT_SECRET')
    if (!clientId || !clientSecret) {
      throw new Error('NCP_CLOVA_CLIENT_ID/SECRET 환경변수 없음')
    }

    // Clova TTS API 호출 (form-urlencoded body, UTF-8 자동 인코딩)
    // AbortController로 stall 방지 — Clova가 응답 없이 멈추면 어르신이 무한 침묵을 듣게 됨
    const clovaSpeed = CLOVA_SPEED_MAP[speed]
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CLOVA_TIMEOUT_MS)

    let clovaRes: Response
    try {
      clovaRes = await fetch(CLOVA_TTS_ENDPOINT, {
        method: 'POST',
        headers: {
          'X-NCP-APIGW-API-KEY-ID': clientId,
          'X-NCP-APIGW-API-KEY': clientSecret,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          speaker: voice,
          text,
          speed: String(clovaSpeed),
          format: 'mp3',
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      // AbortError → 타임아웃 504. 그 외 fetch 자체 실패(DNS·TCP)는 502
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[tts-clova] Clova 응답 타임아웃 (${CLOVA_TIMEOUT_MS}ms 초과)`)
        return new Response(
          JSON.stringify({ error: '음성 생성이 지연되고 있어요. 잠시 후 다시 시도해 주세요' }),
          { status: 504, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }
      throw err
    }
    clearTimeout(timeoutId)

    // Clova 에러 처리 — 본문(JSON 에러 메시지)을 그대로 로그에 남기고 502 매핑
    if (!clovaRes.ok) {
      const errBody = await clovaRes.text().catch(() => '')
      console.error('[tts-clova] Clova API 오류:', clovaRes.status, errBody)
      return new Response(
        JSON.stringify({ error: '음성 생성 서비스에 일시적인 문제가 있어요' }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // MP3 스트림 패스스루 — Response.body(ReadableStream)를 그대로 전달해 first-byte 지연 최소화
    return new Response(clovaRes.body, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'audio/mpeg',
      },
    })

  } catch (error) {
    console.error('[tts-clova] 처리 중 오류:', error)
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
