import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@/types/database'

interface KakaoProfile {
  name: string
  avatarUrl: string | null
}

// 어르신/가족 온보딩 플로우에서 역할과 프로필을 전역 캐시로 유지
interface AuthState {
  user: User | null
  kakaoProfile: KakaoProfile | null
  role: 'senior' | 'family' | null
  profile: Tables<'profiles'> | null
  setUser: (user: User | null) => void
  setKakaoProfile: (profile: KakaoProfile | null) => void
  setRole: (role: 'senior' | 'family') => void
  setProfile: (profile: Tables<'profiles'> | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      kakaoProfile: null,
      role: null,
      profile: null,
      setUser: (user) => set({ user }),
      setKakaoProfile: (kakaoProfile) => set({ kakaoProfile }),
      setRole: (role) => set({ role }),
      setProfile: (profile) => set({ profile }),
      clear: () => set({ user: null, kakaoProfile: null, role: null, profile: null }),
    }),
    { name: 'dadam-auth' },
  ),
)
