import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Book, Chapter, CoverImage } from '@/types/domain'

// F-12/F-13 RPC 함수들은 database.ts 자동 생성 타입에 아직 미포함 → any 캐스트
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

interface UseBookEditReturn {
  book: Book | null
  chapters: Chapter[]
  coverImages: CoverImage[]
  loading: boolean
  softDeleteChapter: (chapterId: string) => Promise<void>
  restoreChapter: (chapterId: string) => Promise<void>
  updateChapterTitle: (chapterId: string, newTitle: string) => Promise<void>
  selectCover: (coverId: string) => Promise<void>
  publishBook: (dedication: string) => Promise<void>
}

export function useBookEdit(bookId: string | undefined): UseBookEditReturn {
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [coverImages, setCoverImages] = useState<CoverImage[]>([])
  const [loading, setLoading] = useState(true)

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

  return { book, chapters, coverImages, loading, softDeleteChapter, restoreChapter, updateChapterTitle, selectCover, publishBook }
}
