import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/auth/hooks/useAuth'

// handle_new_user 트리거가 설정하는 기본값 — 이 값이면 온보딩 미완료
const DEFAULT_DISPLAY_NAME = '사용자'

interface ProtectedRouteProps {
  requiredRole?: 'senior' | 'family'
}

// 인증 상태·역할·온보딩 완료 여부에 따른 라우트 가드
export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { loading, session, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // 세션은 있지만 프로필이 아직 로딩 중 — 리다이렉트하면 루프 발생
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
      </div>
    )
  }

  // 온보딩 미완료 (display_name이 기본값) → 역할 선택으로 강제 이동
  // /role-select, /profile-setup, /reader-setup, /onboarding 자체는 비보호 라우트라 이 가드를 타지 않음
  if (profile.display_name === DEFAULT_DISPLAY_NAME) {
    return <Navigate to="/role-select" replace />
  }

  // 역할 불일치 → 각 역할의 홈으로 리다이렉트
  if (requiredRole && profile.role !== requiredRole) {
    return <Navigate to={profile.role === 'senior' ? '/s' : '/r'} replace />
  }

  return <Outlet />
}
