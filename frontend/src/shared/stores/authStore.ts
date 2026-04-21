import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'

type Role = 'senior' | 'reader' | null

interface KakaoProfile {
  name: string
  avatarUrl: string | null
}

interface AuthState {
  user: User | null
  kakaoProfile: KakaoProfile | null
  role: Role
  setUser: (user: User | null) => void
  setKakaoProfile: (profile: KakaoProfile | null) => void
  setRole: (role: Role) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      kakaoProfile: null,
      role: null,
      setUser: (user) => set({ user }),
      setKakaoProfile: (kakaoProfile) => set({ kakaoProfile }),
      setRole: (role) => set({ role }),
      clear: () => set({ user: null, kakaoProfile: null, role: null }),
    }),
    { name: 'dadam-auth' },
  ),
)
