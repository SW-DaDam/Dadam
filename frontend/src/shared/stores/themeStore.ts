import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  darkMode: boolean
  setDarkMode: (on: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      darkMode: false,
      setDarkMode: (on) => {
        set({ darkMode: on })
        document.documentElement.classList.toggle('dark', on)
      },
    }),
    { name: 'dadam-theme' },
  ),
)

export function initTheme() {
  const stored = localStorage.getItem('dadam-theme')
  if (stored) {
    const { state } = JSON.parse(stored) as { state: { darkMode: boolean } }
    if (state?.darkMode) document.documentElement.classList.add('dark')
  }
}
