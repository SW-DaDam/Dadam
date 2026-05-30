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

// beforeinstallprompt은 React 마운트 전에 발생할 수 있으므로 전역에서 미리 캡처
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
