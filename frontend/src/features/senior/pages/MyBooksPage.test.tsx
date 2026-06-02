// MyBooksPage 테스트 — DraftBookCard 높이 통일 + 단편 초안 문구
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import MyBooksPage from './MyBooksPage'

vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { id: 'u1', user_metadata: { full_name: '권오인' } } }),
  ),
}))
vi.mock('@/features/bookshelf/hooks/useBookshelf', () => ({
  useBookshelf: () => ({
    monthlyBooks: [
      { id: 'm1', title: '경로당의 봄', year: 2026, month: 3,
        chapterCount: 2, status: 'draft', book_type: 'monthly' },
    ],
    shortBooks: [
      { id: 's1', title: '전우와 사투리 친구들', year: 2026, month: 5,
        chapterCount: 0, status: 'draft', book_type: 'short' },
    ],
    loading: false,
    refresh: vi.fn(),
    deleteBook: vi.fn(),
    updateBookTitle: vi.fn(),
  }),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => Promise.resolve({ data: null })),
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  },
}))

function renderPage() {
  return render(<MemoryRouter><MyBooksPage /></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('MyBooksPage — DraftBookCard 썸네일 높이', () => {
  it('단편 Draft 카드 썸네일에 min-h-[88px] 클래스가 적용된다', () => {
    renderPage()
    // "전우와 사투리 친구들" 카드 내 썸네일 div 확인
    const shortCard = screen.getByText('전우와 사투리 친구들').closest('.bg-white')
    expect(shortCard).toBeTruthy()
    const thumbnail = shortCard!.querySelector('[class*="min-h-\\[88px\\]"]')
    expect(thumbnail).toBeTruthy()
  })

  it('월간 Draft 카드 썸네일에도 min-h-[88px] 클래스가 적용된다', () => {
    renderPage()
    const monthlyCard = screen.getByText('경로당의 봄').closest('.bg-white')
    expect(monthlyCard).toBeTruthy()
    const thumbnail = monthlyCard!.querySelector('[class*="min-h-\\[88px\\]"]')
    expect(thumbnail).toBeTruthy()
  })
})

describe('MyBooksPage — 단편 초안 완료 문구', () => {
  it('단편 draft 카드에 "초안 작성이 완료되었어요" 문구가 표시된다', () => {
    renderPage()
    expect(screen.getByText('초안 작성이 완료되었어요')).toBeTruthy()
  })

  it('월간 draft 카드에는 해당 문구가 표시되지 않는다', () => {
    renderPage()
    // 월간은 챕터수/날짜 표시 — 초안 문구 없음
    const monthlyCard = screen.getByText('경로당의 봄').closest('.bg-white')
    expect(monthlyCard?.textContent).not.toContain('초안 작성이 완료되었어요')
  })
})
