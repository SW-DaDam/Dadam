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
  const [refreshKey, setRefreshKey] = useState(0)

  // 외부에서 await 가능한 새로고침 함수 — fetchBooks 완료를 보장해야 하는 호출자(MyBooksPage)용
  const refresh = async () => {
    setRefreshKey((k) => k + 1)
    await fetchBooks()
  }

  async function fetchBooks() {
    // chapters left join: 챕터 0개인 책도 포함
    // comments는 이제 book_id 직접 참조 — 챕터 경유 없이 책에서 바로 조회
    const { data, error } = await supabase
      .from('books')
      .select('*, chapters(id, is_deleted), comments(id)')
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error || !data) return

    setBooks(
      data.map(({ chapters, comments, ...book }) => {
        const chapterList = (chapters as {
          id: string
          is_deleted: boolean
        }[] | null) ?? []

        // is_deleted=false 챕터만 카운트
        const activeChapters = chapterList.filter((ch) => !ch.is_deleted)

        return {
          ...book,
          chapterCount: activeChapters.length,
          // 댓글은 책 단위로 집계
          commentCount: (comments as { id: string }[] | null)?.length ?? 0,
        }
      }),
    )
  }

  useEffect(() => {
    fetchBooks().finally(() => setLoading(false))
  }, [refreshKey])

  // 책 삭제 — chapters/cover_images는 FK CASCADE로 자동 삭제
  async function deleteBook(bookId: string) {
    const { error } = await supabase.from('books').delete().eq('id', bookId)
    if (error) throw new Error(error.message)
    // 로컬 상태 즉시 반영
    setBooks((prev) => prev.filter((b) => b.id !== bookId))
  }

  return {
    books,
    monthlyBooks: books.filter((b) => b.book_type === 'monthly'),
    shortBooks: books.filter((b) => b.book_type === 'short'),
    loading,
    refresh,
    deleteBook,
  }
}
