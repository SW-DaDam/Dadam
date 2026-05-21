import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from './useAuth'

// supabase 모킹
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('초기 로딩 시 loading=true를 반환한다', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
  })

  it('세션이 없으면 user=null을 반환한다', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {})
    expect(result.current.user).toBeNull()
  })

  it('signOut 호출 시 supabase.auth.signOut을 호출한다', async () => {
    const { supabase } = await import('@/lib/supabase')
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signOut()
    })
    expect(supabase.auth.signOut).toHaveBeenCalledOnce()
  })
})
