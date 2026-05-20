// tts-openai Edge Function 호출 래퍼 + TTS 샘플 Storage URL 헬퍼
// MP3 응답을 Blob URL로 변환 → <audio> 엘리먼트 재생에 사용
// 샘플 URL은 정적 조합 (API 호출 없음 — 설정 페이지 미리듣기 비용 0원)

import type { TtsVoice, TtsSpeed } from '@/types/domain'

// 재시도 불가 HTTP 상태 코드
const NON_RETRYABLE_STATUSES: readonly number[] = [401, 403, 422]
const MAX_RETRY_COUNT = 2
const BASE_RETRY_DELAY_MS = 500

// TTS 샘플 Storage 기반 경로 (버킷: tts-samples, public read)
const STORAGE_BASE = () =>
  `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/tts-samples`

// 지수 백오프로 fetch 재시도 (voiceChatClient.ts 동일 패턴)
async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
    if (attempt > 0) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1)
      await new Promise((r) => setTimeout(r, delay))
    }
    const res = await fetch(url, options)
    if (res.ok) return res
    if (NON_RETRYABLE_STATUSES.includes(res.status)) {
      throw new Error(`[ttsOpenaiClient] ${res.status}: 재시도 불가 에러`)
    }
    lastError = new Error(`[ttsOpenaiClient] ${res.status}: 서버 에러`)
  }
  throw lastError ?? new Error('[ttsOpenaiClient] 알 수 없는 에러')
}

// tts-openai Edge Function 호출 → Blob URL 반환
// 반환된 URL은 caller 책임으로 revokeObjectUrl()로 해제해야 함
export async function fetchTts(
  text: string,
  voice: TtsVoice,
  speed: TtsSpeed,
  accessToken: string,
): Promise<string> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts-openai`
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

// 설정 페이지 미리듣기용 샘플 Storage public URL 반환
// 6 voice × 3 speed = 18개 사전 생성된 MP3 파일 (TASK-T8)
// API 호출 없이 정적 URL 조합만으로 즉시 재생 가능
export function getSampleUrl(voice: TtsVoice, speed: TtsSpeed): string {
  return `${STORAGE_BASE()}/${voice}_${speed}.mp3`
}

// Blob URL 해제 헬퍼 — fetchTts()로 생성한 URL을 재생 완료 후 반드시 호출해야 메모리 누수 방지
export function revokeObjectUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
