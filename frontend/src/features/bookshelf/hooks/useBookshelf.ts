import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Book } from '@/types/domain'

// 책장 표시용 — 챕터 수 + 댓글 수 포함
// ShelfRack이 commentCount로 배지를 렌더링하므로 두 필드 모두 필요
export interface BookWithChapterCount extends Book {
  chapterCount: number
  commentCount: number
}

export function useBookshelf() {
  const [books, setBooks] = useState<BookWithChapterCount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchBooks() {
      // chapters left join: 챕터 0개인 책도 포함
      // comments left join (chapters → comments 2단계): 댓글 배지 표시용
      const { data, error } = await supabase
        .from('books')
        .select('*, chapters(id, is_deleted, comments(id))')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (error || !data) return

      setBooks(
        data.map(({ chapters, ...book }) => {
          const chapterList = (chapters as {
            id: string
            is_deleted: boolean
            comments: { id: string }[] | null
          }[] | null) ?? []

          // is_deleted=false 챕터만 카운트
          const activeChapters = chapterList.filter((ch) => !ch.is_deleted)

          return {
            ...book,
            chapterCount: activeChapters.length,
            // 삭제되지 않은 챕터의 댓글 수 합산
            commentCount: activeChapters.reduce(
              (sum, ch) => sum + (ch.comments?.length ?? 0),
              0,
            ),
          }
        }),
      )
    }

    fetchBooks().finally(() => setLoading(false))
  }, [])

  return { books, loading }
}
