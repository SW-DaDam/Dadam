import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'

export interface NotifPrefs {
  new_comment: boolean    // 가족이 댓글을 달았을 때 (저자)
  new_reply: boolean      // 댓글 답장 알림 (저자·독자 공통)
  new_book: boolean       // 새 책 출간 알림 (독자)
  book_draft: boolean     // 이번 달 책 초안 완성 (저자)
  book_publish: boolean   // 책 가족 책장 출간 (저자)
  daily_remind: boolean   // 오늘 대화 미완료 리마인더 (저자)
  family_comment: boolean // 다른 가족 댓글 (독자)
}

export const NOTIF_DEFAULTS: NotifPrefs = {
  new_comment: true,
  new_reply: true,
  new_book: true,
  book_draft: true,
  book_publish: true,
  daily_remind: false,
  family_comment: false,
}

export function useNotificationPrefs() {
  const user = useAuthStore((s) => s.user)
  const [prefs, setPrefs] = useState<NotifPrefs>(NOTIF_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    void supabase
      .from('profiles')
      .select('notification_prefs')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.notification_prefs) {
          setPrefs({ ...NOTIF_DEFAULTS, ...(data.notification_prefs as Partial<NotifPrefs>) })
        }
        setLoading(false)
      })
  }, [user?.id])

  const updatePref = useCallback((key: keyof NotifPrefs, value: boolean) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      void supabase
        .from('profiles')
        .update({ notification_prefs: next })
        .eq('id', user?.id ?? '')
      return next
    })
  }, [user?.id])

  return { prefs, loading, updatePref }
}
