import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTheme } from '@/shared/stores/themeStore'
import { initFontSize } from '@/shared/stores/fontSizeStore'
import { initContentFontSize } from '@/shared/stores/contentFontSizeStore'

initTheme()
initFontSize()
initContentFontSize()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
