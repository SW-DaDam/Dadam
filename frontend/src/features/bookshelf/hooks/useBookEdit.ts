import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Book, Chapter, CoverImage } from '@/types/domain'

// F-12/F-13 RPC 함수들은 database.ts 자동 생성 타입에 아직 미포함 → any 캐스트
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args: Record<string, unknown>) => (supabase as any).rpc(fn, args)

const INITIAL_COVER_COUNT = 3   // 최초 생성되는 표지 수
const EXTRA_COVER_LIMIT = 3     // 사용자가 추가로 만들 수 있는 최대 수
// 표지 생성은 pg_net → Edge Function 비동기 (~85s). 표지가 없으면 3초마다 폴링
const COVER_POLL_INTERVAL_MS = 3000
const COVER_POLL_MAX_ATTEMPTS = 60  // 최대 3분 대기 후 중단

interface UseBookEditReturn {
  book: Book | null
  chapters: Chapter[]
  coverImages: CoverImage[]
  loading: boolean
  coverLoading: boolean          // 표지 생성 대기 중 여부 (폴링 중)
  coverError: boolean            // 표지 fetch 실패 여부 (에러 vs 생성 중 구분)
  regenerating: boolean          // 표지 재생성 중 여부
  extraCoverCount: number        // 현재까지 추가 생성한 수
  extraCoverLimit: number        // 추가 생성 최대 수
  softDeleteChapter: (chapterId: string) => Promise<void>
  restoreChapter: (chapterId: string) => Promise<void>
  updateChapterTitle: (chapterId: string, newTitle: string) => Promise<void>
  updateChapterContent: (chapterId: string, newContent: string) => Promise<void>
  selectCover: (coverId: string) => Promise<void>
  publishBook: (dedication: string) => Promise<void>
  regenerateCover: (chapterId: string) => Promise<void>
}

export function useBookEdit(bookId: string | undefined): UseBookEditReturn {
  const [book, setBook] = useState<Book | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [coverImages, setCoverImages] = useState<CoverImage[]>([])
  const [loading, setLoading] = useState(true)
  const [coverLoading, setCoverLoading] = useState(false)  // 폴링 중 = 표지 생성 대기 중
  const [coverError, setCoverError] = useState(false)      // fetch 실패 (에러 vs 생성 중 구분)
  const [regenerating, setRegenerating] = useState(false)

  // 추가 생성 횟수: 전체 표지 수에서 초기 3장을 뺀 값
  const extraCoverCount = Math.max(0, coverImages.length - INITIAL_COVER_COUNT)

  // 폴링 정리용 ref — cleanup 시 interval 제거
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttemptsRef = useRef(0)

  // 챕터 순서 기준으로 표지 정렬하는 헬퍼
  // selected 표지를 맨 앞에 두어 편집 재진입 시 선택된 표지가 첫 번째로 표시되도록 함
  function sortCoversByChapterOrder(covers: CoverImage[], chapterIds: string[]): CoverImage[] {
    return [...covers].sort((a, b) => {
      // selected 상태가 항상 먼저 오도록
      if (a.status === 'selected' && b.status !== 'selected') return -1
      if (a.status !== 'selected' && b.status === 'selected') return 1
      const ai = chapterIds.indexOf(a.chapter_id ?? '')
      const bi = chapterIds.indexOf(b.chapter_id ?? '')
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  }

  useEffect(() => {
    if (!bookId) { setLoading(false); return }
    const id = bookId

    function stopPolling() {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      pollAttemptsRef.current = 0
    }

    async function load() {
      const [bookRes, chaptersRes, coversRes] = await Promise.all([
        supabase.from('books').select('*').eq('id', id).single(),
        supabase.from('chapters').select('*').eq('book_id', id).order('sort_order'),
        supabase.from('cover_images').select('*').eq('book_id', id).in('status', ['candidate', 'selected']),
      ])

      // fetch 에러 시 에러 상태로 전환 (생성 중 폴링과 구분)
      if (bookRes.error || chaptersRes.error || coversRes.error) {
        console.error('[useBookEdit] 데이터 로드 실패', { bookRes, chaptersRes, coversRes })
        setCoverError(true)
        setCoverLoading(false)
        stopPolling()
        if (bookRes.data) setBook(bookRes.data)
        if (chaptersRes.data) setChapters(chaptersRes.data)
        return
      }

      setCoverError(false)
      if (bookRes.data) setBook(bookRes.data)
      if (chaptersRes.data) setChapters(chaptersRes.data)

      const chapterIds = chaptersRes.data?.map((c) => c.id) ?? []
      if (coversRes.data && coversRes.data.length > 0) {
        setCoverImages(sortCoversByChapterOrder(coversRes.data, chapterIds))
        setCoverLoading(false)
        stopPolling()
      } else {
        // 표지가 없고 에러도 없으면 생성 중으로 판단 — 완료될 때까지 폴링
        setCoverImages([])
        setCoverLoading(true)
        stopPolling()
        pollAttemptsRef.current = 0
        pollTimerRef.current = setInterval(async () => {
          pollAttemptsRef.current += 1
          if (pollAttemptsRef.current > COVER_POLL_MAX_ATTEMPTS) {
            // 타임아웃: 생성 실패로 간주
            setCoverLoading(false)
            setCoverError(true)
            stopPolling()
            return
          }
          const { data: newCovers, error: pollErr } = await supabase
            .from('cover_images')
            .select('*')
            .eq('book_id', id)
            .in('status', ['candidate', 'selected'])
          if (pollErr) {
            setCoverLoading(false)
            setCoverError(true)
            stopPolling()
            return
          }
          if (newCovers && newCovers.length > 0) {
            setCoverImages(sortCoversByChapterOrder(newCovers, chapterIds))
            setCoverLoading(false)
            stopPolling()
          }
        }, COVER_POLL_INTERVAL_MS)
      }
    }

    load().finally(() => setLoading(false))

    return stopPolling  // 언마운트 시 폴링 정리
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

  // chapters RLS: senior_own_chapters (ALL) — 클라이언트 직접 UPDATE 허용
  const updateChapterContent = useCallback(async (chapterId: string, newContent: string) => {
    const prevContent = chapters.find(c => c.id === chapterId)?.content
    setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: newContent } : c))
    const { error } = await supabase
      .from('chapters')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', chapterId)
    if (error) {
      if (prevContent !== undefined)
        setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, content: prevContent } : c))
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

  const regenerateCover = useCallback(async (chapterId: string) => {
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
          // chapter_id: 어떤 챕터 표지를 재생성할지 Edge Function에 전달
          body: JSON.stringify({ book_id: bookId, senior_id: book.senior_id, mode: 'single', chapter_id: chapterId }),
        }
      )
      const data = await res.json()
      // 202: 백그라운드 생성 시작 (EdgeRuntime.waitUntil) — 에러 아님
      if (!res.ok && res.status !== 202) throw new Error(data.error ?? '표지 생성 실패')

      // single 모드는 동기 200(성공) / 500(실패) 반환
      // 202는 향후 비동기 전환 시를 위해 count 기반 폴링으로 처리 (clock skew 무관)
      if (res.status === 202) {
        setCoverLoading(true)
        const prevCount = coverImages.length  // 호출 전 표지 수
        pollAttemptsRef.current = 0
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        pollTimerRef.current = setInterval(async () => {
          pollAttemptsRef.current += 1
          if (pollAttemptsRef.current > COVER_POLL_MAX_ATTEMPTS) {
            setCoverLoading(false)
            setCoverError(true)
            if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
            return
          }
          const { data: newCovers } = await supabase
            .from('cover_images')
            .select('*')
            .eq('book_id', bookId)
            .in('status', ['candidate', 'selected'])
          // row 수가 늘었으면 새 이미지 완성됨 (서버/클라이언트 시계 차이에 무관)
          if (newCovers && newCovers.length > prevCount) {
            const { data: currentChapters } = await supabase
              .from('chapters').select('id').eq('book_id', bookId).order('sort_order')
            const chapterIds = currentChapters?.map((c) => c.id) ?? []
            setCoverImages(sortCoversByChapterOrder(newCovers, chapterIds))
            setCoverLoading(false)
            if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null }
          }
        }, COVER_POLL_INTERVAL_MS)
      } else {
        // 200: 동기 완료 — DB에서 바로 조회
        const [{ data: newCovers }, { data: currentChapters }] = await Promise.all([
          supabase.from('cover_images').select('*').eq('book_id', bookId).in('status', ['candidate', 'selected']),
          supabase.from('chapters').select('id').eq('book_id', bookId).order('sort_order'),
        ])
        if (newCovers) {
          const chapterIds = currentChapters?.map((c) => c.id) ?? []
          setCoverImages(sortCoversByChapterOrder(newCovers, chapterIds))
        }
      }
    } finally {
      setRegenerating(false)
    }
  }, [bookId, book?.senior_id])

  return {
    book, chapters, coverImages, loading, coverLoading, coverError,
    regenerating, extraCoverCount, extraCoverLimit: EXTRA_COVER_LIMIT,
    softDeleteChapter, restoreChapter, updateChapterTitle, updateChapterContent, selectCover, publishBook, regenerateCover,
  }
}
