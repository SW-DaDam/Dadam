import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import { getAuthErrorMessage } from '@/lib/errorMessages'

// 세션 확인 최대 재시도 횟수 (PKCE code exchange 완료 대기)
const MAX_RETRIES = 3
const RETRY_INTERVAL_MS = 800
// handle_new_user 트리거가 설정하는 display_name 기본값 — 이 값이면 온보딩 미완료로 판단
const DEFAULT_DISPLAY_NAME = '사용자'
// PostgREST "no rows" 에러 코드 — 진짜 신규 사용자(트리거 지연)와 DB 오류를 구분
const PGRST_NO_ROWS = 'PGRST116'

// OAuth 콜백 처리: 세션 → 프로필 → 역할/온보딩 분기 라우팅
export function CallbackPage() {
  const navigate = useNavigate()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const { setUser, setKakaoProfile } = useAuthStore()

  useEffect(() => {
    // 카카오가 error 파라미터를 URL에 붙여 돌려보내는 경우 (access_denied 등) 즉시 처리
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get('error')
    if (oauthError) {
      setErrorMsg(getAuthErrorMessage({ code: oauthError }))
      return
    }

    handleCallback()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCallback() {
    let session = null

    // PKCE code exchange가 완료되기 전일 수 있으므로 재시도
    for (let i = 0; i < MAX_RETRIES; i++) {
      const { data, error } = await supabase.auth.getSession()
      if (error) {
        console.error('[Auth] 세션 조회 실패', error)
        navigate('/login', { replace: true })
        return
      }
      if (data.session) {
        session = data.session
        break
      }
      await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS))
    }

    if (!session) {
      navigate('/login', { replace: true })
      return
    }

    // store에 user + kakaoProfile 저장
    // kakaoProfile은 온보딩(ProfileSetupPage/ReaderSetupPage)에서 카카오 이름·사진 표시에 사용
    setUser(session.user)
    setKakaoProfile({
      name: session.user.user_metadata?.full_name ?? session.user.user_metadata?.name ?? '사용자',
      avatarUrl: session.user.user_metadata?.avatar_url ?? null,
    })

    // profiles 조회로 역할 + 온보딩 완료 여부 확인
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', session.user.id)
      .single()

    if (profileError) {
      // [P2 Fix] PGRST116(no rows)만 트리거 지연으로 처리 — 그 외 에러는 로그인으로 복귀
      if ((profileError as { code?: string }).code === PGRST_NO_ROWS) {
        navigate('/role-select', { replace: true })
      } else {
        console.error('[Auth] 프로필 조회 실패', profileError)
        navigate('/login', { replace: true })
      }
      return
    }

    // [P1 Fix] display_name이 기본값이면 온보딩 미완료 — role과 무관하게 역할 선택으로
    if (profileData.display_name === DEFAULT_DISPLAY_NAME) {
      navigate('/role-select', { replace: true })
      return
    }

    if (profileData.role === 'senior') {
      const { data: seniorData } = await supabase
        .from('senior_profiles')
        .select('onboarding_completed')
        .eq('id', session.user.id)
        .single()

      if (seniorData?.onboarding_completed) {
        navigate('/s', { replace: true })
      } else {
        navigate('/role-select', { replace: true })
      }
      return
    }

    // family: display_name 설정 완료 = 온보딩 완료, 독자 홈으로
    navigate('/r', { replace: true })
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6">
        <p className="text-lg text-red-600 text-center">{errorMsg}</p>
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="h-14 px-8 rounded-xl bg-[#E8820C] text-lg text-white"
        >
          로그인으로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
      <p className="text-lg text-gray-600">잠시만 기다려 주세요…</p>
    </div>
  )
}
