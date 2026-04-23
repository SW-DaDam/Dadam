import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

vi.mock('@/features/auth/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/features/auth/hooks/useAuth'
const mockUseAuth = vi.mocked(useAuth)

// 실제 앱 라우팅 구조: senior 전용 보호 라우트와 family 전용 보호 라우트가 분리
function renderWithSeniorRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/r" element={<div>reader-home</div>} />
        <Route path="/auth/callback" element={<div>callback</div>} />
        <Route element={<ProtectedRoute requiredRole="senior" />}>
          <Route path="/s" element={<div>senior-home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

function renderWithFamilyRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/s" element={<div>senior-home</div>} />
        <Route path="/auth/callback" element={<div>callback</div>} />
        <Route element={<ProtectedRoute requiredRole="family" />}>
          <Route path="/r" element={<div>reader-home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  it('비로그인 상태에서 /login으로 리다이렉트한다', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: null,
      user: null,
      profile: null,
      signInWithKakao: vi.fn(),
      signOut: vi.fn(),
    })
    const { getByText } = renderWithSeniorRoute('/s')
    expect(getByText('login')).toBeInTheDocument()
  })

  it('senior가 family 전용 라우트 접근 시 /s로 리다이렉트한다', () => {
    mockUseAuth.mockReturnValue({
      loading: false,
      session: { user: { id: '1' } } as never,
      user: { id: '1' } as never,
      profile: { role: 'senior' } as never,
      signInWithKakao: vi.fn(),
      signOut: vi.fn(),
    })
    const { getByText } = renderWithFamilyRoute('/r')
    expect(getByText('senior-home')).toBeInTheDocument()
  })

  it('loading=true이면 로딩 스피너를 표시한다', () => {
    mockUseAuth.mockReturnValue({
      loading: true,
      session: null,
      user: null,
      profile: null,
      signInWithKakao: vi.fn(),
      signOut: vi.fn(),
    })
    const { container } = renderWithSeniorRoute('/s')
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
