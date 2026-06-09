import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - base64.length % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function usePushSubscription() {
  const user = useAuthStore((s) => s.user)
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const supported = 'serviceWorker' in navigator && 'PushManager' in window

  // 현재 구독 상태 확인
  useEffect(() => {
    if (!user?.id || !supported) return
    void navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription()
    ).then(sub => setSubscribed(!!sub))
  }, [user?.id, supported])

  async function subscribe() {
    if (!user?.id || !supported) return
    setLoading(true)
    setSubscribed(true) // 낙관적 업데이트
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setSubscribed(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      })
      const { endpoint, keys } = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      }, { onConflict: 'user_id,endpoint' })
    } catch {
      setSubscribed(false) // 실패 시 롤백
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!user?.id || !supported) return
    setLoading(true)
    setSubscribed(false) // 낙관적 업데이트
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', sub.endpoint)
      }
    } catch {
      setSubscribed(true) // 실패 시 롤백
    } finally {
      setLoading(false)
    }
  }

  return { supported, subscribed, loading, subscribe, unsubscribe }
}
