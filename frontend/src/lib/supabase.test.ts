import { describe, it, expect, beforeEach, vi } from 'vitest'

// Supabase 클라이언트 초기화 시 환경변수 검증 동작을 테스트한다
describe('createSupabaseClient', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('환경변수 VITE_SUPABASE_URL 이 비어있으면 에러를 던진다', async () => {
    const { createSupabaseClient } = await import('./supabase')

    expect(() =>
      createSupabaseClient({ url: '', anonKey: 'valid-key' }),
    ).toThrowError(/VITE_SUPABASE_URL/)
  })

  it('환경변수 VITE_SUPABASE_ANON_KEY 가 비어있으면 에러를 던진다', async () => {
    const { createSupabaseClient } = await import('./supabase')

    expect(() =>
      createSupabaseClient({ url: 'https://x.supabase.co', anonKey: '' }),
    ).toThrowError(/VITE_SUPABASE_ANON_KEY/)
  })

  it('두 값이 모두 제공되면 Supabase 클라이언트 인스턴스를 반환한다', async () => {
    const { createSupabaseClient } = await import('./supabase')

    const client = createSupabaseClient({
      url: 'https://x.supabase.co',
      anonKey: 'valid-key',
    })

    expect(client).toBeDefined()
    expect(client.auth).toBeDefined()
  })
})
