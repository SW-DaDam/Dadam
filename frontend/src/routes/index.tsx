import { createBrowserRouter } from 'react-router'

// Lazy imports — 코드 스플리팅
import { lazy, Suspense } from 'react'
import AppShell from '@/shared/layouts/AppShell'
import { ProtectedRoute } from '@/shared/components/ProtectedRoute'

const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'))
const RoleSelectPage = lazy(() => import('@/features/auth/pages/RoleSelectPage'))
const OnboardingPage = lazy(() => import('@/features/auth/pages/OnboardingPage'))
const ProfileSetupPage = lazy(() => import('@/features/auth/pages/ProfileSetupPage'))
const ReaderSetupPage = lazy(() => import('@/features/auth/pages/ReaderSetupPage'))
const CallbackPage = lazy(() =>
  import('@/features/auth/pages/CallbackPage').then((m) => ({ default: m.CallbackPage }))
)

// 시니어(저자) 라우트
const SeniorLayout = lazy(() => import('@/features/senior/layouts/SeniorLayout'))
const SeniorHomePage = lazy(() => import('@/features/senior/pages/SeniorHomePage'))
const ChatPage = lazy(() => import('@/features/senior/pages/ChatPage'))
const MyBooksPage = lazy(() => import('@/features/senior/pages/MyBooksPage'))
const FamilyBookshelfPage = lazy(() => import('@/features/senior/pages/FamilyBookshelfPage'))
const BookEditPage = lazy(() => import('@/features/senior/pages/BookEditPage'))
const SeniorBookReadPage = lazy(() => import('@/features/senior/pages/SeniorBookReadPage'))
const AiMemoryPage = lazy(() => import('@/features/senior/pages/AiMemoryPage'))
const SeniorSettingsPage = lazy(() => import('@/features/senior/pages/SeniorSettingsPage'))
const NotificationSettingsPage = lazy(() => import('@/features/senior/pages/NotificationSettingsPage'))
const ProfileEditPage = lazy(() => import('@/features/senior/pages/ProfileEditPage'))
const AiVoiceSettingsPage = lazy(() => import('@/features/senior/pages/AiVoiceSettingsPage'))

// 독자 라우트
const ReaderLayout = lazy(() => import('@/features/reader/layouts/ReaderLayout'))
const ReaderHomePage = lazy(() => import('@/features/reader/pages/ReaderHomePage'))
const BookReadPage = lazy(() => import('@/features/reader/pages/BookReadPage'))
const ReaderSettingsPage = lazy(() => import('@/features/reader/pages/ReaderSettingsPage'))
const ReaderNotificationPage = lazy(() => import('@/features/reader/pages/ReaderNotificationPage'))
const ReaderProfileEditPage = lazy(() => import('@/features/reader/pages/ReaderProfileEditPage'))

// 공통
const NotificationListPage = lazy(() => import('@/features/notifications/pages/NotificationListPage'))
const FamilyInvitePage = lazy(() => import('@/features/family/pages/FamilyInvitePage'))
const ConnectedFamilyPage = lazy(() => import('@/features/family/pages/ConnectedFamilyPage'))
const InviteAcceptPage = lazy(() => import('@/features/family/pages/InviteAcceptPage'))

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-lg text-neutral-500">로딩 중…</div>
    </div>
  )
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<Loading />}>{element}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      // 인증 / 온보딩 (비보호 라우트)
      { path: '/login', element: withSuspense(<LoginPage />) },
      { path: '/auth/callback', element: withSuspense(<CallbackPage />) },
      { path: '/join', element: withSuspense(<InviteAcceptPage />) },
      { path: '/role-select', element: withSuspense(<RoleSelectPage />) },
      { path: '/onboarding', element: withSuspense(<OnboardingPage />) },
      { path: '/profile-setup', element: withSuspense(<ProfileSetupPage />) },
      { path: '/reader-setup', element: withSuspense(<ReaderSetupPage />) },

      // 시니어(저자) — /s/* (senior 전용 보호 라우트)
      {
        element: <ProtectedRoute requiredRole="senior" />,
        children: [
          {
            path: '/s',
            element: withSuspense(<SeniorLayout />),
            children: [
              { index: true, element: withSuspense(<SeniorHomePage />) },
              { path: 'chat', element: withSuspense(<ChatPage />) },
              { path: 'books', element: withSuspense(<MyBooksPage />) },
              { path: 'books/:bookId', element: withSuspense(<SeniorBookReadPage />) },
              { path: 'books/:bookId/edit', element: withSuspense(<BookEditPage />) },
              { path: 'family', element: withSuspense(<FamilyBookshelfPage />) },
              { path: 'memory', element: withSuspense(<AiMemoryPage />) },
              { path: 'settings', element: withSuspense(<SeniorSettingsPage />) },
              { path: 'settings/notifications', element: withSuspense(<NotificationSettingsPage />) },
              { path: 'settings/profile', element: withSuspense(<ProfileEditPage />) },
              { path: 'settings/voice', element: withSuspense(<AiVoiceSettingsPage />) },
              { path: 'notifications', element: withSuspense(<NotificationListPage />) },
              { path: 'family/invite', element: withSuspense(<FamilyInvitePage />) },
              { path: 'family/members', element: withSuspense(<ConnectedFamilyPage />) },
            ],
          },
        ],
      },

      // 독자 — /r/* (family 전용 보호 라우트)
      {
        element: <ProtectedRoute requiredRole="family" />,
        children: [
          {
            path: '/r',
            element: withSuspense(<ReaderLayout />),
            children: [
              { index: true, element: withSuspense(<ReaderHomePage />) },
              { path: 'recent', element: withSuspense(<ReaderHomePage />) },
              { path: 'books/:bookId', element: withSuspense(<BookReadPage />) },
              { path: 'settings', element: withSuspense(<ReaderSettingsPage />) },
              { path: 'settings/profile', element: withSuspense(<ReaderProfileEditPage />) },
              { path: 'notifications', element: withSuspense(<ReaderNotificationPage />) },
              { path: 'family/invite', element: withSuspense(<FamilyInvitePage />) },
              { path: 'family/members', element: withSuspense(<ConnectedFamilyPage />) },
            ],
          },
        ],
      },

      // 테스트 전용 — 인증 없이 ChatPage 직접 접근 (test/voice-chat-f03 브랜치 한정)
      { path: '/test/chat', element: withSuspense(<ChatPage />) },

      // 루트 — 로그인 상태·역할에 따라 리다이렉트 (App.tsx에서 처리)
      { path: '/', element: withSuspense(<LoginPage />) },
    ],
  },
])
