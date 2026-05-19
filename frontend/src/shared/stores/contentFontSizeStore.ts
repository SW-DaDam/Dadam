import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ContentFontSize = 'small' | 'medium' | 'large'

export const CONTENT_FONT_SIZE_MAP: Record<ContentFontSize, string> = {
  small: '18px',
  medium: '21px',
  large: '26px',
}

export const CONTENT_FONT_SIZE_LABELS: Record<ContentFontSize, string> = {
  small: '작음',
  medium: '중간',
  large: '큼',
}

interface ContentFontSizeState {
  contentFontSize: ContentFontSize
  setContentFontSize: (size: ContentFontSize) => void
}

export const useContentFontSizeStore = create<ContentFontSizeState>()(
  persist(
    (set) => ({
      contentFontSize: 'medium',
      setContentFontSize: (size) => {
        set({ contentFontSize: size })
        document.documentElement.style.setProperty('--content-font-size', CONTENT_FONT_SIZE_MAP[size])
      },
    }),
    { name: 'dadam-content-font-size' },
  ),
)

export function initContentFontSize() {
  const stored = localStorage.getItem('dadam-content-font-size')
  if (stored) {
    const { state } = JSON.parse(stored) as { state: { contentFontSize: ContentFontSize } }
    if (state?.contentFontSize) {
      document.documentElement.style.setProperty('--content-font-size', CONTENT_FONT_SIZE_MAP[state.contentFontSize])
      return
    }
  }
  document.documentElement.style.setProperty('--content-font-size', CONTENT_FONT_SIZE_MAP['medium'])
}
