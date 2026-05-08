import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FontSize = 'small' | 'medium' | 'large'

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: '16px',
  medium: '18px',
  large: '22px',
}

interface FontSizeState {
  fontSize: FontSize
  setFontSize: (size: FontSize) => void
}

export const useFontSizeStore = create<FontSizeState>()(
  persist(
    (set) => ({
      fontSize: 'large',
      setFontSize: (size) => {
        set({ fontSize: size })
        document.documentElement.style.fontSize = FONT_SIZE_MAP[size]
      },
    }),
    { name: 'dadam-font-size' },
  ),
)

export function initFontSize() {
  const stored = localStorage.getItem('dadam-font-size')
  if (stored) {
    const { state } = JSON.parse(stored) as { state: { fontSize: FontSize } }
    if (state?.fontSize) {
      document.documentElement.style.fontSize = FONT_SIZE_MAP[state.fontSize]
    }
  } else {
    document.documentElement.style.fontSize = FONT_SIZE_MAP['large']
  }
}
