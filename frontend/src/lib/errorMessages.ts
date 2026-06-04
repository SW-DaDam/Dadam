// Auth 에러 코드 → 한국어 메시지 (카카오 OAuth 관련 케이스 우선)
const AUTH_ERROR_MAP: Record<string, string> = {
  access_denied: '카카오 로그인을 취소하셨어요. 로그인하려면 다시 시도해 주세요.',
  server_error: '카카오 서버에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  temporarily_unavailable: '카카오 서버에 일시적인 문제가 생겼어요. 잠시 후 다시 시도해 주세요.',
  provider_disabled: '카카오 로그인을 현재 사용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  network_error: '인터넷 연결을 확인해 주세요.',
}

// DB 에러 코드 → 한국어 메시지 (PostgreSQL · PostgREST 코드)
const DB_ERROR_MAP: Record<string, string> = {
  '23505': '이미 등록된 정보예요.',
  PGRST301: '로그인이 필요해요.',
}

const DEFAULT_MESSAGE = '잠시 문제가 생겼어요. 다시 시도해 주세요.'

// unknown 에러에서 code 문자열 추출 (AuthError, PostgrestError 모두 대응)
function extractCode(error: unknown): string | undefined {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    return String((error as Record<string, unknown>).code)
  }
  return undefined
}

// Auth 에러 코드를 한국어 사용자 메시지로 변환
export function getAuthErrorMessage(error: unknown): string {
  const code = extractCode(error)
  return (code && AUTH_ERROR_MAP[code]) ?? DEFAULT_MESSAGE
}

// DB(PostgREST/PostgreSQL) 에러 코드를 한국어 사용자 메시지로 변환
export function getDbErrorMessage(error: unknown): string {
  const code = extractCode(error)
  return (code && DB_ERROR_MAP[code]) ?? DEFAULT_MESSAGE
}
