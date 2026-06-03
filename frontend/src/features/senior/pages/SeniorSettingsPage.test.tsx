// SeniorSettingsPage 테스트
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import SeniorSettingsPage from './SeniorSettingsPage'

// 외부 의존성 모킹
vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { id: 'user-1', user_metadata: { full_name: '권오인' }, email: 'test@test.com' },
      profile: { display_name: '아빠' },
      setProfile: vi.fn(),
    }),
  ),
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
          single: vi.fn(() => ({ then: vi.fn() })),
        })),
      })),
    })),
  },
}))

function renderPage() {
  return render(<MemoryRouter><SeniorSettingsPage /></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('SeniorSettingsPage — 프로필 카드', () => {
  it('사용자 이름이 표시된다', () => {
    renderPage()
    expect(screen.getByText('권오인')).toBeTruthy()
  })

  it('"저자" 텍스트만 표시되고 호칭은 표시되지 않는다', () => {
    renderPage()
    expect(screen.getByText('저자')).toBeTruthy()
    // "호칭:" 또는 "아빠"가 서브텍스트에 없어야 함
    expect(screen.queryByText(/호칭/)).toBeNull()
    expect(screen.queryByText(/아빠\s*·\s*저자/)).toBeNull()
  })
})
