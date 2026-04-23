import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CallbackPage } from './CallbackPage'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

// 세션 없음: getSession을 즉시 null 반환, setTimeout도 즉시 resolve 처리
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}))

// MAX_RETRIES(3) * RETRY_INTERVAL_MS(800ms) = 2400ms + 여유 1000ms
const CALLBACK_TIMEOUT = 3500

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockReset()
  })

  it('세션 로딩 중 스피너 텍스트를 표시한다', () => {
    render(
      <MemoryRouter>
        <CallbackPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/잠시만 기다려/)).toBeInTheDocument()
  })

  it('세션 없으면 /login으로 이동한다', async () => {
    render(
      <MemoryRouter>
        <CallbackPage />
      </MemoryRouter>
    )
    await waitFor(
      () => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }),
      { timeout: CALLBACK_TIMEOUT }
    )
  }, CALLBACK_TIMEOUT + 500)
})
