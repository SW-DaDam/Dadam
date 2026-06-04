// tts-clova Edge Function 호출 래퍼 + TTS 샘플 Storage URL 헬퍼
// Naver Clova Voice Premium 사용 — MP3 응답을 Blob URL로 변환해 <audio> 재생
// 샘플 URL은 정적 조합 (API 호출 없음 — 설정 페이지 미리듣기 비용 0원)
//
// Phase 1: voice 1종(ngoeun) 운영. Phase 2 확장 시 호출처 코드 변경 없도록
//          API surface(fetchTts/getSampleUrl/revokeObjectUrl)를 OpenAI 래퍼와 동일하게 유지.

import type { TtsVoice, TtsSpeed } from '@/types/domain'

// 재시도 불가 HTTP 상태 코드 — 인증/권한/입력 오류는 재시도해도 동일하게 실패
const NON_RETRYABLE_STATUSES: readonly number[] = [401, 403, 422]
// 5xx 등 일시적 오류에 대한 최대 재시도 횟수 (음성 응답 지연 최소화 위해 보수적)
const MAX_RETRY_COUNT = 2
// 지수 백오프 기준값 (ms) — attempt 1: 500ms, attempt 2: 1000ms
const BASE_RETRY_DELAY_MS = 500

// TTS 샘플 Storage 기반 경로 (버킷: tts-samples, public read)
// Phase 1: ngoeun_{slow,normal,fast}.mp3 3개 파일만 존재
const STORAGE_BASE = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/tts-samples`

// 지수 백오프로 fetch 재시도 — voiceChatClient.ts와 동일 패턴
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
    if (attempt > 0) {
      // 지수 백오프: 500ms → 1000ms
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
    const res = await fetch(url, options)
    if (res.ok) return res
    if (NON_RETRYABLE_STATUSES.includes(res.status)) {
      throw new Error(`[ttsClovaClient] ${res.status}: 재시도 불가 에러`)
    }
    lastError = new Error(`[ttsClovaClient] ${res.status}: 서버 에러`)
  }
  throw lastError ?? new Error('[ttsClovaClient] 알 수 없는 에러')
}

/**
 * tts-clova Edge Function 호출 → Blob URL 반환
 * 반환된 URL은 caller 책임으로 revokeObjectUrl()로 해제해야 함 (메모리 누수 방지)
 *
 * 음성 응답 지연 최소화 포인트:
 * - Edge Function은 Clova MP3 스트림을 Response.body 그대로 패스스루
 * - 클라이언트는 res.blob()으로 전체 다운로드 후 Blob URL 생성 (브라우저 <audio> 재생 호환성 위해)
 * - 더 짧은 first-byte 재생이 필요하면 향후 MediaSource API 도입 검토 (Phase 2 후속)
 */
export async function fetchTts(
  text: string,
  voice: TtsVoice,
  speed: TtsSpeed,
  accessToken: string,
): Promise<string> {
  // VITE_TTS_DISABLED=true 시 즉시 throw → useVoiceChat의 speechSynthesis 폴백으로 이동
  if (import.meta.env.VITE_TTS_DISABLED === 'true') {
    throw new Error('[ttsClovaClient] TTS disabled (VITE_TTS_DISABLED=true)')
  }
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-clova`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, voice, speed }),
  })

  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * 설정 페이지 미리듣기용 샘플 Storage public URL 반환
 * Phase 1: ngoeun × 3 speed = 3개 사전 생성된 MP3 파일
 * Phase 2: 화자 6종으로 확장 시 6 × 3 = 18개로 재생성
 * API 호출 없이 정적 URL 조합만으로 즉시 재생 가능
 */
export function getSampleUrl(voice: TtsVoice, speed: TtsSpeed): string {
  return `${STORAGE_BASE()}/${voice}_${speed}.mp3`
}

// Blob URL 해제 헬퍼 — fetchTts()로 생성한 URL을 재생 완료 후 반드시 호출해야 메모리 누수 방지
// 외부 URL(https://...) 등은 처리하지 않음 (의도치 않은 사이드이펙트 방지)
export function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
