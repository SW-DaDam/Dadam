// voice-chat Edge Function 호출 래퍼
// 스트리밍 응답을 ReadableStream으로 그대로 반환

// 재시도 불가 HTTP 상태 코드 (인증/권한/유효성 실패)
const NON_RETRYABLE_STATUSES: readonly number[] = [401, 403, 422]
const MAX_RETRY_COUNT = 3
const BASE_RETRY_DELAY_MS = 500

export type VoiceChatMessage = { role: 'user' | 'assistant'; content: string }

// 지수 백오프로 fetch 재시도
// NON_RETRYABLE이거나 MAX_RETRY_COUNT 초과 시 throw
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
      throw new Error(`[voiceChatClient] ${res.status}: 재시도 불가 에러`)
    }
    lastError = new Error(`[voiceChatClient] ${res.status}: 서버 에러`)
  }
  throw lastError ?? new Error('[voiceChatClient] 알 수 없는 에러')
}

// voice-chat Edge Function 호출 → SSE ReadableStream 반환
// messages 배열 전체를 전달해 대화 맥락을 유지한다
export async function streamVoiceChat(
  messages: VoiceChatMessage[],
  accessToken: string,
  seniorId?: string,
): Promise<ReadableStream<Uint8Array>> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-chat`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messages, senior_id: seniorId ?? '' }),
  })
  if (!res.body) throw new Error('[voiceChatClient] 응답 본문이 없습니다')
  return res.body
}
