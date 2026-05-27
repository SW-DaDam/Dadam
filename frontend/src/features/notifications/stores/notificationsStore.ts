import { create } from 'zustand'
import type { Notification } from '@/types/domain'

interface NotificationsState {
  notifications: Notification[]
  loading: boolean
  setNotifications: (notifications: Notification[]) => void
  prependNotification: (notification: Notification) => void
  markOneRead: (id: string) => void
  markAllRead: () => void
  removeNotification: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  loading: true,
  setNotifications: (notifications) => set({ notifications }),
  prependNotification: (notification) =>
    set((s) => ({ notifications: [notification, ...s.notifications] })),
  markOneRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
    })),
  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  setLoading: (loading) => set({ loading }),
}))
