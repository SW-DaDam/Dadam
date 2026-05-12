import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Book, Chapter, CoverImage } from '@/types/domain'

// F-12/F-13 RPC 함수들은 database.ts 자동 생성 타입에 아직 미포함 → any 캐스트
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

const INITIAL_COVER_COUNT = 3   // 최초 생성되는 표지 수
const EXTRA_COVER_LIMIT = 3     // 사용자가 추가로 만들 수 있는 최대 수

interface UseBookEditReturn {
  book: Book | null
  chapters: Chapter[]
  coverImages: CoverImage[]
  loading: boolean
  regenerating: boolean          // 표지 재생성 중 여부
  extraCoverCount: number        // 현재까지 추가 생성한 수
  extraCoverLimit: number        // 추가 생성 최대 수
  softDeleteChapter: (chapterId: string) => Promise<void>
  restoreChapter: (chapterId: string) => Promise<void>
  updateChapterTitle: (chapterId: string, newTitle: string) => Promise<void>
  selectCover: (coverId: string) => Promise<void>
  publishBook: (dedication: string) => Promise<void>
  regenerateCover: () => Promise<void>
}

export function useBookEdit(bookId: string | undefined): UseBookEditReturn {
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [coverImages, setCoverImages] = useState<CoverImage[]>([])
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)

  // 추가 생성 횟수: 전체 표지 수에서 초기 3장을 뺀 값
  const extraCoverCount = Math.max(0, coverImages.length - INITIAL_COVER_COUNT)

  useEffect(() => {
    if (!bookId) { setLoading(false); return }
    const id = bookId

    async function load() {
      const [bookRes, chaptersRes, coversRes] = await Promise.all([
        supabase.from('books').select('*').eq('id', id).single(),
        supabase.from('chapters').select('*').eq('book_id', id).order('sort_order'),
        supabase.from('cover_images').select('*').eq('book_id', id).eq('status', 'candidate'),
      ])
      if (bookRes.data) setBook(bookRes.data)
      if (chaptersRes.data) setChapters(chaptersRes.data)
      if (coversRes.data) setCoverImages(coversRes.data)
    }

    load().finally(() => setLoading(false))
  }, [bookId])

  const softDeleteChapter = useCallback(async (chapterId: string) => {
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, is_deleted: true } : c))
    const { error } = await rpc('soft_delete_chapter', { chapter_id: chapterId })
    if (error) {
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, is_deleted: false } : c))
      throw error
    }
  }, [])

  const restoreChapter = useCallback(async (chapterId: string) => {
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, is_deleted: false } : c))
    const { error } = await rpc('restore_chapter', { chapter_id: chapterId })
    if (error) {
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, is_deleted: true } : c))
      throw error
    }
  }, [])

  const updateChapterTitle = useCallback(async (chapterId: string, newTitle: string) => {
    const prevTitle = chapters.find(c => c.id === chapterId)?.title
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: newTitle } : c))
    const { error } = await rpc('update_chapter_title', { chapter_id: chapterId, new_title: newTitle })
    if (error) {
      if (prevTitle !== undefined)
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, title: prevTitle } : c))
      throw error
    }
  }, [chapters])

  const selectCover = useCallback(async (coverId: string) => {
    if (!bookId) return
    const { error } = await rpc('select_cover', { book_id: bookId, cover_id: coverId })
    if (error) throw error
  }, [bookId])

  const publishBook = useCallback(async (dedication: string) => {
    if (!bookId) return
    const { error } = await rpc('publish_book', { book_id: bookId, dedication })
    if (error) throw error
  }, [bookId])

  const regenerateCover = useCallback(async () => {
    if (!bookId || !book?.senior_id) return
    setRegenerating(true)
    try {
      // anon 세션 토큰으로 single 모드 호출
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('로그인이 필요합니다')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-cover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ book_id: bookId, senior_id: book.senior_id, mode: 'single' }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '표지 생성 실패')

      // 새로 생성된 표지를 DB에서 다시 조회해서 상태 갱신
      const { data: newCovers } = await supabase
        .from('cover_images')
        .select('*')
        .eq('book_id', bookId)
        .eq('status', 'candidate')
        .order('created_at')
      if (newCovers) setCoverImages(newCovers)
    } finally {
      setRegenerating(false)
    }
  }, [bookId, book?.senior_id])

  return {
    book, chapters, coverImages, loading,
    regenerating, extraCoverCount, extraCoverLimit: EXTRA_COVER_LIMIT,
    softDeleteChapter, restoreChapter, updateChapterTitle, selectCover, publishBook, regenerateCover,
  }
}
