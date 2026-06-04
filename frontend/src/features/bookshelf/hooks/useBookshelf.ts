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

  // 책 제목 업데이트 — books.title 컬럼만 변경 (RLS: 본인 책만 수정 가능)
  // 가족 책장(useFamilyBookshelf)은 같은 books 테이블을 fetch하므로 다음 진입 시 자동 반영
  //
  // 중요: .select('id')로 affected row를 명시적으로 받아 0건 케이스를 에러로 식별.
  // Supabase update는 RLS 필터/존재하지 않는 id로 0건 영향 시에도 error를 반환하지 않아
  // silent 성공으로 위장됨 → UI는 "변경됨"으로 보이지만 DB는 그대로인 불일치 방지
  async function updateBookTitle(bookId: string, title: string) {
    const { data, error } = await supabase
      .from('books')
      .update({ title })
      .eq('id', bookId)
      .select('id')

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) {
      // RLS 차단 또는 존재하지 않는 bookId — local state는 절대 갱신하지 않음
      throw new Error('수정 권한이 없거나 책을 찾을 수 없어요')
    }
    // DB 반영 확인 후에만 로컬 상태 갱신
    setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, title } : b)))
  }

  return {
    books,
    monthlyBooks: books.filter((b) => b.book_type === 'monthly'),
    shortBooks: books.filter((b) => b.book_type === 'short'),
    loading,
    refresh,
    deleteBook,
    updateBookTitle,
  }
}
