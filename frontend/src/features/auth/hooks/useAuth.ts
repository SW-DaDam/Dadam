import { useState, useEffect } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { useAuthStore } from '@/shared/stores/authStore'

interface UseAuthReturn {
  session: Session | null
  user: User | null
  profile: Tables<'profiles'> | null
  loading: boolean
  signInWithKakao: () => Promise<void>
  signOut: () => Promise<void>
}

// profiles 테이블에서 현재 사용자 프로필 조회 후 스토어 동기화
async function fetchAndSyncProfile(userId: string): Promise<Tables<'profiles'> | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    console.error('[Auth] 프로필 조회 실패', error)
    return null
  }
  return data
}

// Supabase Auth 세션 구독 + authStore 동기화 훅
export function useAuth(): UseAuthReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { user, profile, setUser, setRole, setProfile, clear } = useAuthStore()

  // 세션 → 스토어 동기화 (INITIAL_SESSION·SIGNED_IN·TOKEN_REFRESHED 공통 처리)
  async function syncAuthState(nextSession: Session | null): Promise<void> {
    if (!nextSession) {
      clear()
      return
    }
    setUser(nextSession.user)
    const fetchedProfile = await fetchAndSyncProfile(nextSession.user.id)
    setProfile(fetchedProfile)
    if (fetchedProfile?.role) setRole(fetchedProfile.role as 'senior' | 'family')
  }

  useEffect(() => {
    // getSession()으로 즉시 세션 확인 — INITIAL_SESSION 대기 없이 빠른 초기화
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      if (initialSession) {
        syncAuthState(initialSession).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      // INITIAL_SESSION은 getSession()으로 처리했으므로 스킵
      if (event === 'INITIAL_SESSION') return

      setSession(newSession)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await syncAuthState(newSession)
      }

      if (event === 'SIGNED_OUT') {
        clear()
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 카카오 OAuth 시작 (redirectTo는 CallbackPage로 고정)
  async function signInWithKakao(): Promise<void> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // options.scopes는 기본 scope에 추가 방식이라 account_email이 포함될 수 있음
        // queryParams.scope로 완전 덮어써야 KOE205(이메일 권한 없음) 오류를 회피할 수 있음
        queryParams: {
          scope: 'profile_nickname profile_image',
        },
      },
    })
    if (error) console.error('[Auth] 카카오 로그인 실패', error)
  }

  // 로그아웃 — 에러여도 로컬 스토어 초기화 (서버 세션은 만료됨)
  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('[Auth] 로그아웃 실패', error)
    clear()
  }

  return {
    session,
    user: session?.user ?? user,
    profile,
    loading,
    signInWithKakao,
    signOut,
  }
}
