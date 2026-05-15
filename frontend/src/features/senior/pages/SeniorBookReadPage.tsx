import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Share2, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/shared/stores/authStore'
import type { Book, Chapter, Comment, Reply, Profile } from '@/types/domain'

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface CommentWithData extends Comment {
  author: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
  replies: Reply[]
}

// ─── 훅: 책 읽기 데이터 조회 ─────────────────────────────────────────────────

function useBookRead(bookId: string | undefined) {
  const [book, setBook] = useState<Book | null>(null)
  const [seniorName, setSeniorName] = useState<string>('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  // 댓글은 챕터 단위가 아닌 책 단위로 관리
  const [bookComments, setBookComments] = useState<CommentWithData[]>([])
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!bookId) { setLoading(false); return }

    // 책 정보 조회
    const { data: bookData } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single()

    if (!bookData) return
    setBook(bookData)

    // 선택된 표지 이미지 조회 (selected 우선, 없으면 candidate 첫 번째)
    const { data: selectedCover } = await supabase
      .from('cover_images')
      .select('image_url')
      .eq('book_id', bookId)
      .eq('status', 'selected')
      .single()

    if (selectedCover) {
      setCoverImageUrl(selectedCover.image_url)
    } else {
      const { data: candidateCover } = await supabase
        .from('cover_images')
        .select('image_url')
        .eq('book_id', bookId)
        .eq('status', 'candidate')
        .limit(1)
        .single()
      setCoverImageUrl(candidateCover?.image_url ?? null)
    }

    // 시니어 프로필(이름) 조회
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', bookData.senior_id)
      .single()
    setSeniorName(profileData?.display_name ?? '')

    // 챕터 조회 (삭제되지 않은 것만, sort_order 순)
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .eq('is_deleted', false)
      .order('sort_order')

    setChapters(chaptersData ?? [])

    // 책 단위 댓글 + 답글 + 작성자 프로필 조회
    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, replies(*)')
      .eq('book_id', bookId)
      .order('created_at')

    const authorIds = [...new Set((commentsData ?? []).map((c) => c.author_id))]
    const { data: authorsData } = authorIds.length > 0
      ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', authorIds)
      : { data: [] }

    const authorMap = new Map((authorsData ?? []).map((p) => [p.id, p]))

    setBookComments(
      (commentsData ?? []).map((comment) => ({
        ...comment,
        author: authorMap.get(comment.author_id) ?? null,
        replies: (comment.replies as unknown as Reply[]) ?? [],
      }))
    )
  }, [bookId])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  return { book, seniorName, chapters, bookComments, coverImageUrl, loading, reload: load }
}

// ─── 표지 플레이스홀더 팔레트 ────────────────────────────────────────────────

const COVER_PALETTE = [
  { from: '#C4614A', to: '#7B1F35' },
  { from: '#7B5080', to: '#3D1F5A' },
  { from: '#B85470', to: '#6B1F3A' },
  { from: '#4A7A68', to: '#1A4A38' },
  { from: '#5A7A9A', to: '#1A3A5A' },
  { from: '#9A7060', to: '#5A3828' },
]
function coverPaletteFor(month: number) {
  return COVER_PALETTE[(month - 1) % COVER_PALETTE.length]
}

// ─── 아바타 ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#E8820C', '#16A34A', '#0369A1', '#7C3AED', '#BE185D', '#CA8A04']
const AVATAR_BGS   = ['#FFF0DC', '#DCFCE7', '#E0F2FE', '#F3E8FF', '#FCE7F3', '#FEF9C3']

function avatarStyle(id: string) {
  // id 문자 합산으로 색상 결정 — 같은 사람은 항상 같은 색
  const n = id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  return { bg: AVATAR_BGS[n % AVATAR_BGS.length], color: AVATAR_COLORS[n % AVATAR_COLORS.length] }
}

function initial(name: string | null | undefined) {
  return name ? name[0] : '?'
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

export default function SeniorBookReadPage() {
  const navigate = useNavigate()
  const { bookId } = useParams<{ bookId: string }>()
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const { book, seniorName, chapters, bookComments, coverImageUrl, loading, reload } = useBookRead(bookId)

  // 저자 표시 이름: 로그인 유저가 책 저자일 때만 user_metadata 사용, 가족 뷰어는 seniorName
  const isAuthor = book ? user?.id === book.senior_id : false
  const kakaoName: string = isAuthor
    ? (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? seniorName)
    : seniorName

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [readingOpen, setReadingOpen] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 챕터 로드 완료 시 첫 번째 챕터 선택
  // dedication이 있으면 0장(작가의 말)이 기본이므로 자동 설정 생략
  useEffect(() => {
    if (chapters.length > 0 && !activeChapterId && !(book?.dedication && book.dedication.trim())) {
      setActiveChapterId(chapters[0].id)
    }
  }, [chapters, activeChapterId, book?.dedication])

  // Realtime 댓글 구독 — book_id 기반 (F-15)
  useEffect(() => {
    if (!bookId) return

    function startPolling() {
      if (pollingRef.current) return
      pollingRef.current = setInterval(async () => { await reload() }, 10_000)
    }
    function stopPolling() {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    }

    const channel = supabase
      .channel(`comments:book:${bookId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'comments',
        filter: `book_id=eq.${bookId}`,
      }, async () => { await reload() })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') { stopPolling(); await reload() }
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') { startPolling() }
      })

    return () => { stopPolling(); supabase.removeChannel(channel) }
  }, [bookId, reload])

  useEffect(() => { return () => { if (pollingRef.current) clearInterval(pollingRef.current) } }, [])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // 댓글 전송 — 댓글은 책 단위로 저장, 어르신에게 알림 발송 (F-15)
  async function handleSubmitComment() {
    if (!commentText.trim() || !bookId || !profile || !book) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('comments').insert({
        book_id: bookId,
        author_id: profile.id,
        content: commentText.trim(),
      })
      if (error) throw error

      // 어르신에게 새 댓글 알림 발송
      await supabase.from('notifications').insert({
        recipient_id: book.senior_id,
        type: 'new_comment',
        title: `${kakaoName}이 댓글을 남겼어요`,
        body: commentText.trim(),
        reference_id: bookId,
        reference_type: 'book',
      })

      setCommentText('')
      showToast('댓글을 전달했어요')
      await reload()
    } catch {
      showToast('댓글 전달에 실패했어요')
    } finally {
      setSubmitting(false)
    }
  }

  const activeChapter = chapters.find((c) => c.id === activeChapterId) ?? null
  const totalComments = bookComments.length

  // ─── 로딩 ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">불러오는 중…</p>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">책을 찾을 수 없어요</p>
      </div>
    )
  }

  const headerTitle = `${book.year}년 ${book.month}월 이야기`

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0] relative">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          {headerTitle}
        </h1>
        <button type="button"
          className="ml-auto bg-[#FFF0DC] rounded-xl px-3 py-2 flex flex-col items-center min-h-11 justify-center">
          <Share2 size={15} className="text-[#E8820C]" />
          <span className="text-xs text-[#E8820C]">공유</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto">


        {chapters.length === 0 ? (
          <div className="mx-3 mt-3 bg-white rounded-2xl px-6 py-10 text-center">
            <p className="text-[1.125rem] text-[#9CA3AF]">챕터가 없어요</p>
          </div>
        ) : (
          <>
            {/* 표지 카드 */}
            {chapters.length > 0 && (() => {
              const cp = coverPaletteFor(book.month)
              return (
                <button
                  type="button"
                  className="mx-3 mt-3 rounded-2xl overflow-hidden w-[calc(100%-1.5rem)] aspect-[3/4] relative flex flex-col items-center justify-between p-8"
                  style={{ background: coverImageUrl ? undefined : `linear-gradient(155deg, ${cp.from} 0%, ${cp.to} 100%)` }}
                  // 작가의 말이 있으면 0장(null)부터, 없으면 1장부터 열기
                  onClick={() => {
                    if (book.dedication && book.dedication.trim()) {
                      setActiveChapterId(null)
                    } else if (!activeChapterId && chapters.length > 0) {
                      // dedication 없고 아직 챕터 선택 안 된 경우 1장으로 초기화
                      setActiveChapterId(chapters[0].id)
                    }
                    setReadingOpen(true)
                  }}
                >
                  {coverImageUrl && (
                    <img src={coverImageUrl} alt={book.title} className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/20 rounded-2xl" />
                  {/* 제목·저자 — 상단 고정 (표지 이미지 상단이 비어있는 구도에 맞춤) */}
                  <div className="relative w-full flex flex-col items-center gap-2 pt-2">
                    <div className="h-[1.5px] w-full rounded-full bg-white/50" />
                    <div className="h-[1px] w-full rounded-full bg-white/25" />
                    <p className="text-[1.75rem] font-bold text-white text-center leading-snug drop-shadow mt-2">
                      {book.title}
                    </p>
                    <p className="text-base text-white/70">
                      {kakaoName} 지음 · {book.year}년 {book.month}월
                    </p>
                  </div>
                  <div className="relative flex flex-col items-center gap-2">
                    <div className="h-[1px] w-12 rounded-full bg-white/40" />
                    <p className="text-sm text-white/60 tracking-wide">눌러서 읽기</p>
                  </div>
                </button>
              )
            })()}

            {/* 댓글 섹션 — 책 단위 댓글 전체 표시 */}
            <div className="bg-white mx-3 mt-3 rounded-2xl px-5 py-5 flex flex-col gap-4">
              <p className="text-[1.125rem] font-bold text-[#1F2937]">
                가족 댓글 {totalComments}개
              </p>

              <div className="h-px bg-[#E5E7EB]" />

              {bookComments.length === 0 ? (
                <p className="text-base text-[#9CA3AF] text-center py-2">
                  아직 댓글이 없어요
                </p>
              ) : (
                bookComments.map((comment) => {
                  const style = avatarStyle(comment.author_id)
                  return (
                    <div key={comment.id} className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: style.bg }}>
                          <span className="text-sm font-bold" style={{ color: style.color }}>
                            {initial(comment.author?.display_name)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-base font-bold text-[#1F2937]">
                            {comment.author?.display_name ?? '가족'}
                          </p>
                          <p className="text-[1.125rem] text-[#1F2937]">{comment.content}</p>
                          <p className="text-sm text-[#6B7280]">
                            {new Date(comment.created_at).toLocaleDateString('ko-KR', {
                              month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="ml-6 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-white">
                              {initial(seniorName)}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-[0.9375rem] font-bold text-[#E8820C]">
                              {seniorName || '저자'}의 답장
                            </p>
                            <p className="text-[1.125rem] text-[#1F2937]">{reply.content}</p>
                            <p className="text-sm text-[#6B7280]">
                              {new Date(reply.created_at).toLocaleDateString('ko-KR', {
                                month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}

              <div className="h-px bg-[#E5E7EB]" />

              {/* 댓글 입력 */}
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment() }}
                  placeholder="댓글 남기기"
                  className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.125rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none focus:border-[#E8820C]"
                />
                <button type="button"
                  onClick={handleSubmitComment}
                  disabled={submitting || !commentText.trim()}
                  className="w-full bg-[#E8820C] rounded-xl py-3 min-h-11 disabled:opacity-50">
                  <span className="text-[1.125rem] text-white">
                    {submitting ? '전달 중…' : '전달하기'}
                  </span>
                </button>
              </div>

              {/* 음성 댓글 안내 */}
              <div className="bg-[#FFF8F0] rounded-2xl px-4 py-4 flex flex-col items-center gap-3">
                <p className="text-base text-[#6B7280] text-center">
                  음성으로 댓글을 남기려면 마이크 버튼을 눌러주세요
                </p>
                <button type="button"
                  className="w-12 h-12 rounded-full bg-[#FFF0DC] flex items-center justify-center">
                  <Mic size={22} className="text-[#E8820C]" />
                </button>
                <span className="text-base text-[#E8820C]">음성 댓글</span>
              </div>
            </div>
          </>
        )}

      </main>

      {/* 풀스크린 읽기 오버레이 */}
      {readingOpen && activeChapter && (() => {
        const chapterIdx = chapters.findIndex(c => c.id === activeChapterId)
        // 0장 = 작가의 말(dedication), 1장~ = 일반 챕터
        // readingPage: -1 = 작가의 말, 0~ = 챕터 인덱스
        const hasAuthorNote = !!(book.dedication && book.dedication.trim())
        // 전체 페이지 수: 작가의 말(있으면) + 챕터 수
        const totalPages = (hasAuthorNote ? 1 : 0) + chapters.length
        // 현재 페이지 인덱스 (작가의 말 = 0, 1장 = 1, ...)
        const currentPageIdx = hasAuthorNote ? chapterIdx + 1 : chapterIdx
        const isAuthorNotePage = false  // 현재 activeChapterId로 챕터 페이지만 표시

        // hasAuthorNote면 1장(chapterIdx=0)에서도 이전(작가의 말)으로 이동 가능
        const hasPrev = hasAuthorNote ? chapterIdx >= 0 : chapterIdx > 0
        const hasNext = chapterIdx < chapters.length - 1

        return (
          <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: '#FFFBF5' }}>

            {/* 상단 바 */}
            <div className="flex items-center justify-between px-4 h-[56px] shrink-0 border-b border-[#EDE0CC]">
              <button
                type="button"
                onClick={() => setReadingOpen(false)}
                className="flex items-center gap-1 min-h-11 min-w-11"
              >
                <ChevronLeft size={20} className="text-[#9CA3AF]" />
                <span className="text-[0.9375rem] text-[#9CA3AF]">표지</span>
              </button>
              <p className="text-sm text-[#9CA3AF]">{book.title}</p>
              <span className="text-sm text-[#9CA3AF] min-w-11 text-right">
                {currentPageIdx + 1} / {totalPages}
              </span>
            </div>

            {/* 본문 영역 */}
            <div className="flex-1 overflow-y-auto">
              <div className="w-full max-w-xl mx-auto px-6 pt-10 pb-12">

                {/* 챕터 번호 */}
                <p className="text-[0.8125rem] font-semibold tracking-[0.15em] text-[#E8820C] mb-3">
                  {chapterIdx + 1}장
                </p>

                {/* 챕터 제목 */}
                <h2 className="text-[1.5rem] font-bold text-[#1F2937] leading-snug mb-6">
                  {activeChapter.title}
                </h2>

                {/* 구분선 */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="h-px flex-1 bg-[#EDE0CC]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#E8820C] opacity-50" />
                  <div className="h-px flex-1 bg-[#EDE0CC]" />
                </div>

                {/* 본문 */}
                <p className="text-[1.125rem] text-[#2D2D2D] leading-[2.1] whitespace-pre-wrap tracking-wide">
                  {activeChapter.content}
                </p>
              </div>
            </div>

            {/* 하단 챕터 이동 */}
            <div className="shrink-0 border-t border-[#EDE0CC] flex items-center" style={{ backgroundColor: '#FFFBF5' }}>
              <button
                type="button"
                onClick={() => {
                  if (!hasPrev) return
                  // 1장(chapterIdx=0)에서 이전 = 작가의 말(null)
                  if (chapterIdx === 0 && hasAuthorNote) setActiveChapterId(null)
                  else setActiveChapterId(chapters[chapterIdx - 1].id)
                }}
                disabled={!hasPrev}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30"
              >
                <ChevronLeft size={18} className="text-[#6B7280]" />
                <span className="text-base text-[#6B7280]">이전 장</span>
              </button>

              <div className="flex gap-1.5 px-4">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === currentPageIdx ? '20px' : '6px',
                      height: '6px',
                      backgroundColor: i === currentPageIdx ? '#E8820C' : '#D1D5DB',
                    }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => hasNext && setActiveChapterId(chapters[chapterIdx + 1].id)}
                disabled={!hasNext}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30"
              >
                <span className="text-base text-[#6B7280]">다음 장</span>
                <ChevronLeft size={18} className="text-[#6B7280] rotate-180" />
              </button>
            </div>
          </div>
        )
      })()}

      {/* 풀스크린 작가의 말 오버레이 — 표지 카드 탭 시 0장으로 진입 */}
      {readingOpen && !activeChapter && book.dedication && book.dedication.trim() && (
        <div className="absolute inset-0 z-50 flex flex-col" style={{ backgroundColor: '#FFFBF5' }}>
          <div className="flex items-center justify-between px-4 h-[56px] shrink-0 border-b border-[#EDE0CC]">
            <button type="button" onClick={() => setReadingOpen(false)}
              className="flex items-center gap-1 min-h-11 min-w-11">
              <ChevronLeft size={20} className="text-[#9CA3AF]" />
              <span className="text-[0.9375rem] text-[#9CA3AF]">표지</span>
            </button>
            <p className="text-sm text-[#9CA3AF]">{book.title}</p>
            <span className="text-sm text-[#9CA3AF] min-w-11 text-right">0 / {chapters.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="w-full max-w-xl mx-auto px-6 pt-10 pb-12">
              <p className="text-[0.8125rem] font-semibold tracking-[0.15em] text-[#E8820C] mb-3">작가의 말</p>
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px flex-1 bg-[#EDE0CC]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#E8820C] opacity-50" />
                <div className="h-px flex-1 bg-[#EDE0CC]" />
              </div>
              <p className="text-[1.125rem] text-[#2D2D2D] leading-[2.1] whitespace-pre-wrap tracking-wide">
                {book.dedication}
              </p>
            </div>
          </div>
          <div className="shrink-0 border-t border-[#EDE0CC] flex items-center" style={{ backgroundColor: '#FFFBF5' }}>
            <button type="button" disabled className="flex-1 flex items-center justify-center gap-1.5 py-4 opacity-30">
              <ChevronLeft size={18} className="text-[#6B7280]" />
              <span className="text-base text-[#6B7280]">이전 장</span>
            </button>
            <div className="flex gap-1.5 px-4">
              {/* 작가의 말 페이지 인디케이터 */}
              <div className="rounded-full" style={{ width: '20px', height: '6px', backgroundColor: '#E8820C' }} />
              {chapters.map((_, i) => (
                <div key={i} className="rounded-full" style={{ width: '6px', height: '6px', backgroundColor: '#D1D5DB' }} />
              ))}
            </div>
            <button type="button"
              onClick={() => { if (chapters.length > 0) setActiveChapterId(chapters[0].id) }}
              disabled={chapters.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-4 disabled:opacity-30">
              <span className="text-base text-[#6B7280]">다음 장</span>
              <ChevronLeft size={18} className="text-[#6B7280] rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] rounded-xl px-5 py-3 shadow-lg">
          <p className="text-base text-white whitespace-nowrap">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}
