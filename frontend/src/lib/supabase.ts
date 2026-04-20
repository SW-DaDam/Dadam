// Supabase 클라이언트 초기화 모듈
// 환경변수 누락 시 런타임 초기에 명확한 에러를 던져 설정 실수를 조기에 파악한다
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

interface SupabaseClientConfig {
  url: string
  anonKey: string
}

// 환경변수 유효성 검증 후 Supabase 클라이언트를 생성한다
export function createSupabaseClient(config: SupabaseClientConfig): SupabaseClient {
  if (!config.url) {
    throw new Error('VITE_SUPABASE_URL 이 설정되지 않았습니다. .env.local 을 확인하세요.')
  }
  if (!config.anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.')
  }
  return createClient(config.url, config.anonKey)
}

// 지연 초기화: 첫 호출 시점에만 환경변수를 읽어 클라이언트 생성
// (모듈 import 시점이 아닌, 실제 사용 시점에 검증 수행)
let cachedClient: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!cachedClient) {
    cachedClient = createSupabaseClient({
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    })
  }
  return cachedClient
}
