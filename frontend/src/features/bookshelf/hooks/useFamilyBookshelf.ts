import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { BookWithStats } from '@/types/domain'

export function useFamilyBookshelf() {
  const [books, setBooks] = useState<BookWithStats[]>([])
  const [seniorId, setSeniorId] = useState<string | null>(null)
  const [seniorName, setSeniorName] = useState<string>('')
  const [relationship, setRelationship] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    async function fetch() {
      // 1. accepted 상태 family_link에서 연결된 senior_id + 호칭 조회
      const { data: link } = await supabase
        .from('family_links')
        .select('senior_id, senior_title, reader_nickname, relationship')
        .eq('family_id', user!.id)
        .eq('invite_status', 'accepted')
        .limit(1)
        .maybeSingle()

      if (!link?.senior_id) { setLoading(false); return }

      const linkedSeniorId = link.senior_id
      setSeniorId(linkedSeniorId)
      // reader_nickname: 저자가 독자를 부르는 호칭 (표시용 관계)
      setRelationship(link.reader_nickname ?? link.relationship ?? '')

      // senior_title: 독자가 저자를 부르는 호칭 → "아빠의 책장" 등에 사용
      // 없으면 profile.display_name 폴백
      if (link.senior_title) {
        setSeniorName(link.senior_title)
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', linkedSeniorId)
          .single()
        setSeniorName(profile?.display_name ?? '')
      }

      // 3. published 책 + 챕터·댓글 수 조회 (댓글은 book_id 직접 참조)
      const { data } = await supabase
        .from('books')
        .select('*, chapters(id, is_deleted), comments(id)')
        .eq('senior_id', linkedSeniorId)
        .eq('status', 'published')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (!data) { setLoading(false); return }

      setBooks(
        data.map(({ chapters, comments, ...book }) => {
          const chapterList = (chapters as {
            id: string
            is_deleted: boolean
          }[] | null) ?? []
          const active = chapterList.filter((ch) => !ch.is_deleted)
          return {
            ...book,
            chapterCount: active.length,
            commentCount: (comments as { id: string }[] | null)?.length ?? 0,
          }
        }),
      )
      setLoading(false)
    }

    fetch()
  }, [user?.id])

  return { books, seniorId, seniorName, relationship, loading }
}
