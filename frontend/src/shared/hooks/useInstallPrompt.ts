import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaInstallPrompt?: Event
  }
}

export type Platform = 'android' | 'ios' | 'other'
export type InstallState = 'installable' | 'installed' | 'unavailable'

function getPlatform(): Platform {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) && !('MSStream' in window)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export function useInstallPrompt() {
  const platform = getPlatform()
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null)
  const [installState, setInstallState] = useState<InstallState>(() =>
    isStandalone() ? 'installed' : platform === 'ios' ? 'installable' : 'unavailable'
  )

  useEffect(() => {
    if (platform !== 'android') return

    // React 마운트 전에 이미 캡처된 이벤트가 있으면 바로 사용
    if (window.__pwaInstallPrompt) {
      deferredPrompt.current = window.__pwaInstallPrompt as BeforeInstallPromptEvent
      setInstallState('installable')
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      window.__pwaInstallPrompt = e
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setInstallState('installable')
    }
    const onInstalled = () => {
      setInstallState('installed')
      deferredPrompt.current = null
      window.__pwaInstallPrompt = undefined
    }

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [platform])

  async function install() {
    if (!deferredPrompt.current) return
    await deferredPrompt.current.prompt()
    deferredPrompt.current = null
    window.__pwaInstallPrompt = undefined
  }

  return { platform, installState, install }
}
