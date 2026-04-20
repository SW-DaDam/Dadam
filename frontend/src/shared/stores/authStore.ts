import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@supabase/supabase-js'

type Role = 'senior' | 'reader' | null

interface AuthState {
  user: User | null
  role: Role
  setUser: (user: User | null) => void
  setRole: (role: Role) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      role: null,
      setUser: (user) => set({ user }),
      setRole: (role) => set({ role }),
      clear: () => set({ user: null, role: null }),
    }),
    { name: 'dadam-auth' },
  ),
)
