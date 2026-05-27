import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types/domain'
import { useAuthStore } from '@/shared/stores/authStore'
import { useNotificationsStore } from '../stores/notificationsStore'

const PAGE_SIZE = 50
const POLLING_MS = 30_000
let _channelSeq = 0

export function useNotifications() {
  const user = useAuthStore((s) => s.user)
  const {
    notifications,
    loading,
    setNotifications,
    prependNotification,
    markOneRead,
    markAllRead: storeMarkAllRead,
    removeNotification,
    setLoading,
  } = useNotificationsStore()

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unreadCount = notifications.filter((n) => !n.is_read).length

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (error) return
    setNotifications(data ?? [])
  }, [user?.id, setNotifications])

  const markAsRead = useCallback(async (id: string) => {
    markOneRead(id)
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }, [markOneRead])

  const markAllRead = useCallback(async () => {
    if (!user?.id) return
    storeMarkAllRead()
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)
  }, [user?.id, storeMarkAllRead])

  useEffect(() => {
    if (!user?.id) return

    fetchNotifications().finally(() => setLoading(false))

    const channel = supabase
      .channel(`notifications:user:${user.id}:${++_channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          prependNotification(payload.new as Notification)
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!pollingRef.current) {
            pollingRef.current = setInterval(fetchNotifications, POLLING_MS)
          }
        }
      })

    return () => {
      supabase.removeChannel(channel)
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [user?.id, fetchNotifications, prependNotification, setLoading])

  const deleteNotification = useCallback(async (id: string) => {
    removeNotification(id)
    await supabase.from('notifications').delete().eq('id', id)
  }, [removeNotification])

  return { notifications, unreadCount, loading, markAsRead, markAllRead, deleteNotification }
}
