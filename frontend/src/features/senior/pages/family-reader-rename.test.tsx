// 가족 → 독자 텍스트 변경 검증 테스트
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import SeniorSettingsPage from './SeniorSettingsPage'
import NotificationSettingsPage from './NotificationSettingsPage'
import ReaderNotificationSettingsPage from '@/features/reader/pages/ReaderNotificationSettingsPage'

// --- SeniorSettingsPage 공통 mock ---
const mockUseAuthStore = vi.fn()
vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => mockUseAuthStore(sel),
}))
vi.mock('@/shared/stores/themeStore', () => ({
  useThemeStore: () => ({ darkMode: false, setDarkMode: vi.fn() }),
}))
vi.mock('@/shared/stores/fontSizeStore', () => ({
  useFontSizeStore: () => ({ fontSize: 'medium', setFontSize: vi.fn() }),
}))
vi.mock('@/features/memory/hooks/useMemory', () => ({
  useMemory: () => ({ items: [] }),
}))
vi.mock('@/features/family/hooks/useInvite', () => ({
  useInvite: () => ({ familyMembers: [], inviteCode: null }),
}))
vi.mock('@/shared/hooks/useInstallPrompt', () => ({
  useInstallPrompt: () => ({ platform: null, install: vi.fn() }),
}))
vi.mock('@/shared/hooks/usePushSubscription', () => ({
  usePushSubscription: () => ({
    supported: false, subscribed: false,
    subscribe: vi.fn(), unsubscribe: vi.fn(),
  }),
}))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}))
vi.mock('@/features/notifications/hooks/useNotificationPrefs', () => ({
  useNotificationPrefs: () => ({
    prefs: {
      book_draft: true,
      author_new_comment: true,
      author_reply: true,
      author_family_comment: true,
      new_book: true,
      reader_author_comment: true,
      reader_reply: true,
      reader_other_comment: true,
    },
    loading: false,
    updatePref: vi.fn(),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuthStore.mockImplementation((sel) =>
    sel({
      user: { id: 'u1', user_metadata: { full_name: '권오인' } },
      profile: { display_name: '아빠' },
      setProfile: vi.fn(),
    }),
  )
})

// ── SeniorSettingsPage ──────────────────────────────
describe('SeniorSettingsPage — 가족→독자 텍스트', () => {
  it('"독자 초대하기" 가 표시된다', () => {
    render(<MemoryRouter><SeniorSettingsPage /></MemoryRouter>)
    expect(screen.getByText('독자 초대하기')).toBeTruthy()
  })

  it('"가족 초대하기" 가 표시되지 않는다', () => {
    render(<MemoryRouter><SeniorSettingsPage /></MemoryRouter>)
    expect(screen.queryByText('가족 초대하기')).toBeNull()
  })

  it('"연결된 독자" 가 표시된다', () => {
    render(<MemoryRouter><SeniorSettingsPage /></MemoryRouter>)
    expect(screen.getByText('연결된 독자')).toBeTruthy()
  })

  it('"카카오 링크로 가족, 지인 초대" 서브텍스트가 표시된다', () => {
    render(<MemoryRouter><SeniorSettingsPage /></MemoryRouter>)
    expect(screen.getByText('카카오 링크로 가족, 지인 초대')).toBeTruthy()
  })
})

// ── NotificationSettingsPage ────────────────────────
describe('NotificationSettingsPage — 가족→독자 텍스트', () => {
  it('저자 댓글 알림 세부 항목이 표시된다', () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>)
    expect(screen.getByText('내 책의 새 댓글')).toBeTruthy()
    expect(screen.getByText('내 댓글의 답글')).toBeTruthy()
    expect(screen.getByText('가족끼리 주고받는 댓글')).toBeTruthy()
  })

  it('"댓글 알림" 섹션 헤더가 표시된다', () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>)
    expect(screen.getByText('댓글 알림')).toBeTruthy()
  })

  it('"책이 독자 책장에 출간됐을 때" 가 표시되지 않는다', () => {
    render(<MemoryRouter><NotificationSettingsPage /></MemoryRouter>)
    expect(screen.queryByText('책이 독자 책장에 출간됐을 때')).toBeNull()
  })
})

describe('ReaderNotificationSettingsPage — 댓글 알림 세분화', () => {
  it('독자 댓글 알림 세부 항목이 표시된다', () => {
    render(<MemoryRouter><ReaderNotificationSettingsPage /></MemoryRouter>)
    expect(screen.getByText('저자의 새 댓글')).toBeTruthy()
    expect(screen.getByText('내 댓글의 답글')).toBeTruthy()
    expect(screen.getByText('다른 독자의 새 댓글')).toBeTruthy()
  })

  it('기존 다른 가족 댓글 항목은 표시되지 않는다', () => {
    render(<MemoryRouter><ReaderNotificationSettingsPage /></MemoryRouter>)
    expect(screen.queryByText('다른 가족 댓글')).toBeNull()
  })
})
