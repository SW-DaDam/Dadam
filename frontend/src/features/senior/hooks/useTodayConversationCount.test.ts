import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTodayConversationCount } from './useTodayConversationCount'

const gteMock = vi.fn().mockResolvedValue({ count: 2, error: null })
const eqMock = vi.fn(() => ({ gte: gteMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ select: selectMock })),
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('useTodayConversationCount', () => {
  it('Supabase가 count: 2를 반환하면 todayCount가 2이다', async () => {
    const { result } = renderHook(() =>
      useTodayConversationCount('senior-id-1'),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.todayCount).toBe(2)
  })

  it('Supabase 에러 시 todayCount는 0으로 유지된다', async () => {
    gteMock.mockResolvedValueOnce({ count: null, error: { message: 'DB 에러' } })
    const { result } = renderHook(() =>
      useTodayConversationCount('senior-id-1'),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.todayCount).toBe(0)
  })

  it('seniorId가 빈 문자열이면 supabase.from을 호출하지 않는다', async () => {
    const { supabase } = await import('@/lib/supabase')
    const { result } = renderHook(() => useTodayConversationCount(''))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('loading은 쿼리 완료 후 false가 된다', async () => {
    const { result } = renderHook(() =>
      useTodayConversationCount('senior-id-1'),
    )
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })
})
