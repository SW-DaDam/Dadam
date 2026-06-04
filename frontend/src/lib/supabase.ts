import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

interface SupabaseClientConfig {
  url: string
  anonKey: string
}

export function createSupabaseClient(config: SupabaseClientConfig): SupabaseClient<Database> {
  if (!config.url) {
    throw new Error('VITE_SUPABASE_URL 이 설정되지 않았습니다. .env.local 을 확인하세요.')
  }
  if (!config.anonKey) {
    throw new Error('VITE_SUPABASE_ANON_KEY 가 설정되지 않았습니다. .env.local 을 확인하세요.')
  }
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      persistSession: true,     // 로컬 스토리지에 세션 저장 → 새로고침 후 유지
      autoRefreshToken: true,   // access_token 만료 임박 시 자동 갱신
      detectSessionInUrl: true, // OAuth 콜백 URL의 code/fragment 자동 파싱 (TASK-06 필수)
    },
  })
}

let cachedClient: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (!cachedClient) {
    cachedClient = createSupabaseClient({
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    })
  }
  return cachedClient
}

export const supabase = getSupabase()
