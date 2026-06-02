// ProfileEditPage 테스트 — 호칭 섹션 제거
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import ProfileEditPage from './ProfileEditPage'

vi.mock('@/shared/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { id: 'u1', user_metadata: { full_name: '권오인' }, email: 'test@test.com' },
      profile: { display_name: '아빠' },
      setProfile: vi.fn(),
    }),
  ),
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
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}))

function renderPage() {
  return render(<MemoryRouter><ProfileEditPage /></MemoryRouter>)
}

beforeEach(() => { vi.clearAllMocks() })

describe('ProfileEditPage — 호칭 섹션 제거', () => {
  it('"호칭" 레이블이 렌더링되지 않는다', () => {
    renderPage()
    expect(screen.queryByText('호칭')).toBeNull()
  })

  it('"자주 쓰는 호칭" 텍스트가 렌더링되지 않는다', () => {
    renderPage()
    expect(screen.queryByText('자주 쓰는 호칭')).toBeNull()
  })

  it('호칭 프리셋 버튼(엄마/아빠/할머니/할아버지)이 렌더링되지 않는다', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: '엄마' })).toBeNull()
    expect(screen.queryByRole('button', { name: '아빠' })).toBeNull()
    expect(screen.queryByRole('button', { name: '할머니' })).toBeNull()
    expect(screen.queryByRole('button', { name: '할아버지' })).toBeNull()
  })

  it('"가족 책장에" 미리보기 배너가 렌더링되지 않는다', () => {
    renderPage()
    expect(screen.queryByText(/가족 책장에/)).toBeNull()
  })

  it('기본 정보(이름·성별·출생연도) 섹션은 여전히 렌더링된다', () => {
    renderPage()
    expect(screen.getByText('기본 정보')).toBeTruthy()
    expect(screen.getByText('이름')).toBeTruthy()
    expect(screen.getByText('성별')).toBeTruthy()
    expect(screen.getByText('출생연도')).toBeTruthy()
  })
})
