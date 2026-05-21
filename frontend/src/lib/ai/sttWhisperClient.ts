// stt-whisper Edge Function 호출 래퍼
// MediaRecorder로 녹음한 Blob을 multipart/form-data로 전송 → 텍스트 반환
// voiceChatClient.ts의 재시도 패턴을 동일하게 적용

// 재시도 불가 HTTP 상태 코드 (인증/권한/유효성 실패)
const NON_RETRYABLE_STATUSES: readonly number[] = [401, 403, 422]
const MAX_RETRY_COUNT = 2
const BASE_RETRY_DELAY_MS = 500

// Whisper API 파일 크기 제한 — 클라이언트 사전 검증용 (서버에서도 검증하지만 사용자 안내를 위해 선제 체크)
const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  // 25MB

// MediaRecorder mimeType 우선순위 fallback
// audio/webm;codecs=opus (최선) → audio/webm → audio/mp4 → '' (브라우저 기본)
const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  '',
] as const

// 현재 브라우저가 지원하는 최선의 mimeType 반환
export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  for (const mimeType of MIME_TYPE_CANDIDATES) {
    if (mimeType === '' || MediaRecorder.isTypeSupported(mimeType)) return mimeType
  }
  return ''
}

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
      const body = await res.json().catch(() => ({ error: '알 수 없는 오류' }))
      throw new Error(`[sttWhisperClient] ${res.status}: ${body.error ?? '재시도 불가 에러'}`)
    }
    lastError = new Error(`[sttWhisperClient] ${res.status}: 서버 에러`)
  }
  throw lastError ?? new Error('[sttWhisperClient] 알 수 없는 에러')
}

// stt-whisper Edge Function 호출 → 텍스트 반환
// audio Blob을 multipart/form-data로 전송
export async function uploadAudio(
  blob: Blob,
  seniorId: string,
  accessToken: string,
): Promise<{ text: string }> {
  // 파일 크기 사전 검증 — 서버 왕복 없이 즉시 안내
  if (blob.size > MAX_AUDIO_SIZE_BYTES) {
    throw new Error('이야기가 너무 길어요. 잠시 끊고 말씀해 주세요')
  }

  const formData = new FormData()
  // Whisper API는 확장자를 파일명에서 추론하므로 mimeType에 맞는 확장자 지정
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  formData.append('audio', blob, `audio.${ext}`)
  formData.append('senior_id', seniorId)

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stt-whisper`
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Content-Type은 자동 설정 — FormData 사용 시 브라우저가 boundary 포함해서 지정
    },
    body: formData,
  })

  return res.json() as Promise<{ text: string }>
}
