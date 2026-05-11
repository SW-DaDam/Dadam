import { useState, useEffect, useCallback } from 'react'
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

interface ChapterWithComments extends Chapter {
  comments: CommentWithData[]
}

// ─── 훅: 책 읽기 데이터 조회 ─────────────────────────────────────────────────

function useBookRead(bookId: string | undefined) {
  const [book, setBook] = useState<Book | null>(null)
  const [seniorName, setSeniorName] = useState<string>('')
  const [chapters, setChapters] = useState<ChapterWithComments[]>([])
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

    if (!chaptersData || chaptersData.length === 0) {
      setChapters([])
      return
    }

    // 각 챕터의 댓글 + 답글 + 작성자 프로필 조회
    const chapterIds = chaptersData.map((c) => c.id)

    const { data: commentsData } = await supabase
      .from('comments')
      .select('*, replies(*)')
      .in('chapter_id', chapterIds)
      .order('created_at')

    // 댓글 작성자 프로필 일괄 조회
    const authorIds = [...new Set((commentsData ?? []).map((c) => c.author_id))]
    const { data: authorsData } = authorIds.length > 0
      ? await supabase.from('profiles').select('id, display_name, avatar_url').in('id', authorIds)
      : { data: [] }

    const authorMap = new Map((authorsData ?? []).map((p) => [p.id, p]))

    // 챕터별로 댓글 그룹화
    const commentsByChapter = new Map<string, CommentWithData[]>()
    for (const comment of commentsData ?? []) {
      const list = commentsByChapter.get(comment.chapter_id) ?? []
      list.push({
        ...comment,
        author: authorMap.get(comment.author_id) ?? null,
        replies: (comment.replies as Reply[]) ?? [],
      })
      commentsByChapter.set(comment.chapter_id, list)
    }

    setChapters(
      chaptersData.map((ch) => ({
        ...ch,
        comments: commentsByChapter.get(ch.id) ?? [],
      }))
    )
  }, [bookId])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  return { book, seniorName, chapters, loading, reload: load }
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
  const { book, seniorName, chapters, loading, reload } = useBookRead(bookId)

  // 카카오 실명: user_metadata.full_name → full_name → display_name 순으로 fallback
  const kakaoName: string =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    seniorName

  const [activeChapterId, setActiveChapterId] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // 챕터 로드 완료 시 첫 번째 챕터 선택
  useEffect(() => {
    if (chapters.length > 0 && !activeChapterId) {
      setActiveChapterId(chapters[0].id)
    }
  }, [chapters, activeChapterId])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // 댓글 전송
  async function handleSubmitComment() {
    if (!commentText.trim() || !activeChapterId || !profile) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('comments').insert({
        chapter_id: activeChapterId,
        author_id: profile.id,
        content: commentText.trim(),
      })
      if (error) throw error
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
  const totalComments = chapters.reduce((s, c) => s + c.comments.length, 0)

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">

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

        {/* 책 표지 카드 */}
        <div className="mx-3 mt-3 bg-[#FFF0DC] rounded-2xl px-6 py-5 flex flex-col items-center gap-2 relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-2 bg-[#E8820C] opacity-25" />
          <div className="absolute top-0 bottom-0 right-0 w-2 bg-[#E8820C] opacity-15" />
          <div className="w-full h-[1.5px] border-t border-[#E8820C] opacity-20" />
          <p className="text-[1.5rem] font-bold text-[#E8820C]">{book.title}</p>
          <p className="text-base text-[#6B7280]">
            {kakaoName} 지음 · {book.year}년 {book.month}월
          </p>
          <div className="w-full h-[1.5px] border-t border-[#E8820C] opacity-20" />
        </div>

        {chapters.length === 0 ? (
          <div className="mx-3 mt-3 bg-white rounded-2xl px-6 py-10 text-center">
            <p className="text-[1.125rem] text-[#9CA3AF]">챕터가 없어요</p>
          </div>
        ) : (
          <>
            {/* 챕터 탭 — 가로 스크롤, 번호만 표시 */}
            <div className="bg-white border-b border-[#E5E7EB] flex overflow-x-auto scrollbar-none">
              {chapters.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChapterId(c.id)}
                  className={cn(
                    'shrink-0 py-3 px-5 text-[1.0625rem] relative text-center whitespace-nowrap',
                    c.id === activeChapterId ? 'text-[#E8820C] font-bold' : 'text-[#6B7280]',
                    i > 0 ? 'border-l border-[#E5E7EB]' : '',
                  )}
                >
                  {`${i + 1}장`}
                  {c.id === activeChapterId && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#E8820C] rounded-t" />
                  )}
                </button>
              ))}
            </div>

            {/* 선택된 챕터 제목 표시 */}
            {activeChapter && (
              <div className="bg-white px-6 pt-4 pb-0">
                <p className="text-sm text-[#9CA3AF]">
                  {chapters.findIndex(c => c.id === activeChapterId) + 1}장 · {activeChapter.title}
                </p>
              </div>
            )}

            {/* 본문 */}
            {activeChapter && (
              <>
                <div className="bg-white px-6 py-5 flex flex-col gap-3">
                  <p className="text-[1.0625rem] text-[#1F2937] leading-relaxed whitespace-pre-wrap">
                    {activeChapter.content}
                  </p>
                </div>

                <div className="h-px bg-[#E5E7EB]" />

                {/* 댓글 섹션 */}
                <div className="bg-white px-6 py-5 flex flex-col gap-4">
                  <p className="text-[1.125rem] font-bold text-[#1F2937]">
                    가족 댓글 {totalComments}개
                  </p>

                  <div className="h-px bg-[#E5E7EB]" />

                  {activeChapter.comments.length === 0 ? (
                    <p className="text-base text-[#9CA3AF] text-center py-2">
                      아직 댓글이 없어요
                    </p>
                  ) : (
                    activeChapter.comments.map((comment) => {
                      const style = avatarStyle(comment.author_id)
                      return (
                        <div key={comment.id} className="flex flex-col gap-3">
                          {/* 댓글 */}
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

                          {/* 시니어 답장 */}
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
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitComment() }}
                      placeholder="댓글 남기기"
                      className="flex-1 bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.125rem] text-[#1F2937] placeholder-[#D1D5DB] outline-none focus:border-[#E8820C]"
                    />
                    <button type="button"
                      onClick={handleSubmitComment}
                      disabled={submitting || !commentText.trim()}
                      className="bg-[#E8820C] rounded-xl px-4 py-3 min-h-11 shrink-0 disabled:opacity-50">
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
          </>
        )}

      </main>

      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] rounded-xl px-5 py-3 shadow-lg">
          <p className="text-base text-white whitespace-nowrap">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}
