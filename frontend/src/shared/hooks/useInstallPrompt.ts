import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallPlatform = 'android' | 'ios' | 'other'

const DISMISS_KEY = 'dadam-install-dismissed'
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000

function getPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  // iPadOS 13+ reports as MacIntel with maxTouchPoints > 1
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIos && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua)) return 'ios'
  return 'other'
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

function wasDismissed(): boolean {
  const ts = localStorage.getItem(DISMISS_KEY)
  return !!ts && Date.now() - Number(ts) < DISMISS_TTL_MS
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [platform] = useState<InstallPlatform>(getPlatform)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || wasDismissed()) return

    if (platform === 'ios') {
      setVisible(true)
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [platform])

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setVisible(false)
  }, [])

  return {
    platform,
    visible: visible && (platform === 'ios' || deferredPrompt !== null),
    install,
    dismiss,
  }
}
