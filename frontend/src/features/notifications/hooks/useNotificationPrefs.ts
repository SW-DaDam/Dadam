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
  author_new_comment: boolean // 내 책의 새 댓글 (저자)
  author_reply: boolean       // 내 댓글의 답글 (저자)
  author_family_comment: boolean // 가족끼리 주고받는 댓글 (저자)
}

export const NOTIF_DEFAULTS: NotifPrefs = {
  new_comment: true,
  new_reply: true,
  new_book: true,
  book_draft: true,
  book_publish: true,
  daily_remind: false,
  family_comment: false,
  author_new_comment: true,
  author_reply: true,
  author_family_comment: true,
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
    if (!user?.id) return
    setPrefs((prev) => {
      const next = { ...prev, [key]: value }
      supabase
        .from('profiles')
        .update({ notification_prefs: next })
        .eq('id', user.id)
        .then(({ error }) => {
          if (error) console.error('[알림 설정 저장 실패]', error.message)
        })
      return next
    })
  }, [user?.id])

  // 푸시 알림 OFF 시 모든 알림 끄기
  const disableAll = useCallback(() => {
    if (!user?.id) return
    const all_off: NotifPrefs = {
      new_comment: false,
      new_reply: false,
      new_book: false,
      book_draft: false,
      book_publish: false,
      daily_remind: false,
      family_comment: false,
      author_new_comment: false,
      author_reply: false,
      author_family_comment: false,
    }
    setPrefs(all_off)
    void supabase.from('profiles').update({ notification_prefs: all_off as unknown as Record<string, boolean> }).eq('id', user.id)
  }, [user?.id])

  // 푸시 알림 ON 시 모든 알림 켜기 (daily_remind는 opt-in 항목이라 제외)
  const enableAll = useCallback(() => {
    if (!user?.id) return
    const all_on: NotifPrefs = {
      new_comment: true,
      new_reply: true,
      new_book: true,
      book_draft: true,
      book_publish: true,
      daily_remind: false,
      family_comment: true,
      author_new_comment: true,
      author_reply: true,
      author_family_comment: true,
    }
    setPrefs(all_on)
    void supabase.from('profiles').update({ notification_prefs: all_on as unknown as Record<string, boolean> }).eq('id', user.id)
  }, [user?.id])

  return { prefs, loading, updatePref, disableAll, enableAll }
}
