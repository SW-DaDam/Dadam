// stt-whisper: 어르신 발화 음성 → 텍스트 변환 Edge Function
// OpenAI whisper-1 REST batch 방식 사용 (v1/audio/transcriptions)
//
// 모델 선정 사유:
// - 초기 의도된 `gpt-realtime-whisper`는 Realtime API(WebSocket) 전용 모델이라
//   REST `/v1/audio/transcriptions`에서 404 반환 (라운드트립 테스트에서 확인됨)
// - `whisper-1`은 동일 endpoint에서 multipart/form-data 방식으로 정상 동작하며
//   분당 $0.006 단순 과금, 한국어 포함 99개 언어 지원
// - 시연 후 시니어 발화 인식 품질이 부족하면 `gpt-4o-mini-transcribe`로 모델명만 교체 가능
//
// F-03(음성 대화) 및 F-13(작가의 말 음성 녹음) 양쪽에서 재사용됨

import { createClient } from 'npm:@supabase/supabase-js'
import OpenAI from 'npm:openai'

// CORS 헤더 (voice-chat과 동일 패턴)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Whisper API 단일 파일 최대 크기 제한 (바이트)
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  // 25MB

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

    // anon 클라이언트로 JWT 검증 및 호출자 uid 추출 (voice-chat과 동일 패턴)
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

    // multipart/form-data 파싱
    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return new Response(
        JSON.stringify({ error: '잘못된 요청 형식입니다 (multipart/form-data 필요)' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // audio 파일 추출
    const audioEntry = formData.get('audio')
    if (!(audioEntry instanceof File)) {
      return new Response(
        JSON.stringify({ error: 'audio 파일이 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // senior_id 추출 및 소유권 검증 (본인만 허용)
    const seniorId = formData.get('senior_id')
    if (typeof seniorId !== 'string' || !seniorId) {
      return new Response(
        JSON.stringify({ error: 'senior_id가 필요합니다' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }
    if (user.id !== seniorId) {
      return new Response(
        JSON.stringify({ error: '권한이 없습니다' }),
        { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // 파일 크기 검증 (25MB 초과 시 422 — 클라이언트에서도 사전 검증하지만 서버에서도 방어)
    if (audioEntry.size > MAX_AUDIO_SIZE_BYTES) {
      return new Response(
        JSON.stringify({ error: '이야기가 너무 길어요. 잠시 끊고 말씀해 주세요' }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // OpenAI Whisper API 호출
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') ?? '' })
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioEntry,
      language: 'ko',
      prompt: '.',  // 무음/잡음 입력 시 Whisper 환각 감소 — 빈 컨텍스트 힌트
    })

    return new Response(
      JSON.stringify({ text: transcription.text }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    console.error('[stt-whisper] 처리 중 오류:', error)
    // OpenAI API 호출 실패는 502로 반환
    const isOpenAiError = error instanceof Error && error.message.includes('OpenAI')
    return new Response(
      JSON.stringify({ error: isOpenAiError ? '음성 인식 서비스에 일시적인 문제가 있어요' : String(error) }),
      { status: isOpenAiError ? 502 : 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
