// SeniorHomePage 테스트 — 시간대별 인사말 랜덤
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import SeniorHomePage from './SeniorHomePage'

vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ user: { id: 'u1', user_metadata: { full_name: '권오인' } } }),
  ),
}))
vi.mock('@/features/notifications/components/NotificationBell', () => ({
  NotificationBell: () => null,
}))
vi.mock('@/features/notifications/hooks/useNotifications', () => ({
  useNotifications: () => ({ notifications: [] }),
}))
vi.mock('@/features/senior/hooks/useMonthlyConversationDays', () => ({
  useMonthlyConversationDays: () => ({ days: 1, remaining: 28, total: 29 }),
}))
vi.mock('@/lib/utils', () => ({
  timeAgo: vi.fn(() => '방금 전'),
  cn: (...args: string[]) => args.filter(Boolean).join(' '),
}))

function renderPage() {
  return render(<MemoryRouter><SeniorHomePage /></MemoryRouter>)
}

// 시간대 시뮬레이션 헬퍼
function mockHour(hour: number) {
  const date = new Date()
  date.setHours(hour, 0, 0, 0)
  vi.setSystemTime(date)
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('SeniorHomePage — 시간대별 인사말', () => {
  it('아침(오전 8시) — "좋은 아침이에요" 계열 인사말이 표시된다', () => {
    mockHour(8)
    renderPage()
    const greeting = screen.getByTestId('greeting-text').textContent ?? ''
    expect(greeting).toMatch(/아침|건강|활기/)
  })

  it('점심(오후 12시) — "점심" 계열 인사말이 표시된다', () => {
    mockHour(12)
    renderPage()
    const greeting = screen.getByTestId('greeting-text').textContent ?? ''
    expect(greeting).toMatch(/점심/)
  })

  it('오후(오후 3시) — "오후" 계열 인사말이 표시된다', () => {
    mockHour(15)
    renderPage()
    const greeting = screen.getByTestId('greeting-text').textContent ?? ''
    expect(greeting).toMatch(/오후|하루/)
  })

  it('저녁(오후 7시) — "저녁" 계열 인사말이 표시된다', () => {
    mockHour(19)
    renderPage()
    const greeting = screen.getByTestId('greeting-text').textContent ?? ''
    expect(greeting).toMatch(/저녁|하루/)
  })

  it('밤(오후 11시) — "밤" 계열 인사말이 표시된다', () => {
    mockHour(23)
    renderPage()
    const greeting = screen.getByTestId('greeting-text').textContent ?? ''
    expect(greeting).toMatch(/늦은|편안|꿈/)
  })

  it('인사말에 사용자 이름이 포함된다', () => {
    mockHour(9)
    renderPage()
    expect(screen.getByTestId('greeting-text').textContent).toContain('권오인')
  })
})
