import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'

const SERVICE_WORKER_TIMEOUT_MS = 5000

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - base64.length % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

async function getReadyServiceWorker(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      window.setTimeout(
        () => reject(new Error('서비스 워커를 준비하지 못했어요')),
        SERVICE_WORKER_TIMEOUT_MS,
      )
    }),
  ])
}

export function usePushSubscription() {
  const user = useAuthStore((state) => state.user)
  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(supported && !!user?.id)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id || !supported) return

    let cancelled = false
    void getReadyServiceWorker()
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (!cancelled) setSubscribed(!!subscription)
      })
      .catch(() => {
        if (!cancelled) setSubscribed(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user?.id, supported])

  async function subscribe(): Promise<boolean> {
    if (!user?.id || !supported) {
      setError('이 브라우저에서는 푸시 알림을 사용할 수 없어요')
      return false
    }

    setLoading(true)
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        throw new Error('브라우저 설정에서 알림 권한을 허용해 주세요')
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) throw new Error('푸시 알림 설정이 완료되지 않았어요')

      const registration = await getReadyServiceWorker()
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      })
      const { endpoint, keys } = subscription.toJSON() as {
        endpoint?: string
        keys?: { p256dh?: string; auth?: string }
      }

      if (!endpoint || !keys?.p256dh || !keys.auth) {
        throw new Error('푸시 구독 정보를 만들지 못했어요')
      }

      const { error: saveError } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }, { onConflict: 'user_id,endpoint' })
      if (saveError) throw saveError

      setSubscribed(true)
      return true
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '푸시 알림을 켜지 못했어요'
      console.error('[푸시 구독 실패]', cause)
      setSubscribed(false)
      setError(message)
      return false
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe(): Promise<boolean> {
    if (!user?.id || !supported) return false

    setLoading(true)
    setError(null)
    try {
      const registration = await getReadyServiceWorker()
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        await subscription.unsubscribe()
        const { error: deleteError } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint)
        if (deleteError) console.error('[푸시 구독 정보 삭제 실패]', deleteError)
      }

      setSubscribed(false)
      return true
    } catch (cause) {
      console.error('[푸시 구독 해제 실패]', cause)
      setError('푸시 알림을 끄지 못했어요. 잠시 후 다시 시도해 주세요')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { supported, subscribed, loading, error, subscribe, unsubscribe }
}
