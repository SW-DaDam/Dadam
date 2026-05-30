import { useEffect, useRef, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
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

    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt.current = e as BeforeInstallPromptEvent
      setInstallState('installable')
    }
    const onInstalled = () => {
      setInstallState('installed')
      deferredPrompt.current = null
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
  }

  return { platform, installState, install }
}
