import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Edit3, Trash2, X, ChevronLeft, ChevronRight, Loader2, BookOpen } from 'lucide-react'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'
import { TopicSelectionModal, type TopicCandidate } from '@/features/bookshelf/components/TopicSelectionModal'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'

// 월 번호 → 표지 색상 팔레트 (월 % 4 기준 순환)
const COVER_PALETTES = [
  { bg: '#FFF0DC', border: '#E8820C', accent: '#E8820C', textColor: '#E8820C' },
  { bg: '#DCFCE7', border: '#16A34A', accent: '#16A34A', textColor: '#16A34A' },
  { bg: '#FEF9C3', border: '#CA8A04', accent: '#CA8A04', textColor: '#CA8A04' },
  { bg: '#F3F4F6', border: '#E5E7EB', accent: '#9CA3AF', textColor: '#6B7280' },
]

// 단편 책 전용 팔레트 — 항상 노랑 고정
const SHORT_BOOK_PALETTE = { bg: '#FEF9C3', border: '#FACC15', accent: '#FACC15', textColor: '#CA8A04' }

// 월간 책 생성 단계 메시지
const MONTHLY_STEP_MESSAGES = [
  '이달의 이야기를 모으고 있어요...',
  '챕터를 구성하고 있어요...',
  '책 표지를 그리고 있어요...',
  '마무리 중이에요...',
]

// 단편 책 생성 단계 메시지
const SHORT_STEP_MESSAGES = [
  '이야기를 모으고 있어요...',
  '단편을 쓰고 있어요...',
  '책 표지를 그리고 있어요...',
  '마무리 중이에요...',
]

function getPalette(month: number) {
  return COVER_PALETTES[(month - 1) % COVER_PALETTES.length]
}

export default function MyBooksPage() {
  const navigate = useNavigate()
  const { monthlyBooks, shortBooks, loading, refresh, deleteBook } = useBookshelf()
  const user = useAuthStore((s) => s.user)

  // 연/월 선택 모달 (월간 책)
  const now = new Date()
  const [monthModalOpen, setMonthModalOpen] = useState(false)
  const [selectYear, setSelectYear] = useState(now.getFullYear())
  const [selectMonth, setSelectMonth] = useState(now.getMonth() + 1)

  // 단편 책 주제 선택 모달
  const [topicModalOpen, setTopicModalOpen] = useState(false)

  // 월간 책 생성 오버레이
  const [generating, setGenerating] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)

  // 단편 책 생성 오버레이 (월간과 독립적으로 관리)
  const [shortGenerating, setShortGenerating] = useState(false)
  const [shortStepIdx, setShortStepIdx] = useState(0)

  // 공용 에러 토스트
  const [genError, setGenError] = useState<string | null>(null)

  // 책 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteBook() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteBook(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      setGenError('삭제에 실패했어요. 다시 시도해 주세요')
    } finally {
      setDeleting(false)
    }
  }

  // 월간 책 작성 중 / 단편 책 작성 중 — 각각 버튼 비활성화 기준
  const monthlyDraftBook = monthlyBooks.find((b) => b.status === 'draft' || b.status === 'editing')
  const shortDraftBook = shortBooks.find((b) => b.status === 'draft' || b.status === 'editing')
  const publishedMonthly = monthlyBooks.filter((b) => b.status === 'published')
  const publishedShorts = shortBooks.filter((b) => b.status === 'published')

  // 월간 책 생성: RPC → Edge Function 호출
  const handleCreateBook = useCallback(async () => {
    if (!user) return
    setMonthModalOpen(false)
    setGenerating(true)
    setGenError(null)
    setStepIdx(0)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobId, error: rpcErr } = await (supabase as any).rpc('trigger_book_generation', {
        p_senior_id: user.id,
        p_year: selectYear,
        p_month: selectMonth,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('로그인이 필요합니다')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ job_id: jobId }),
        }
      )

      // 409: 이미 해당 월 월간 책이 있음 → 해당 책으로 이동
      // book_type='monthly' 필터 필수: 같은 달에 단편 책이 있을 경우 잘못된 책으로 이동 방지
      if (res.status === 409) {
        setGenerating(false)
        const { data: existingBook } = await supabase
          .from('books')
          .select('id')
          .eq('senior_id', user.id)
          .eq('book_type', 'monthly')
          .eq('year', selectYear)
          .eq('month', selectMonth)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (existingBook) navigate(`/s/books/${existingBook.id}/edit`)
        else await refresh()
        return
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `책 생성 실패 (${res.status})`)
      }

      await refresh()
      setGenerating(false)

      const { data: newBook } = await supabase
        .from('books')
        .select('id')
        .eq('senior_id', user.id)
        .eq('book_type', 'monthly')
        .eq('status', 'editing')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (newBook) navigate(`/s/books/${newBook.id}/edit`)

    } catch (err) {
      setGenerating(false)
      setGenError(err instanceof Error ? err.message : '오류가 발생했어요')
    }
  }, [user, selectYear, selectMonth, navigate, refresh])

  // 단편 책 생성: 주제 선택 → RPC → Edge Function 호출
  const handleCreateShortBook = useCallback(async (topic: TopicCandidate) => {
    if (!user) return
    setShortGenerating(true)
    setShortStepIdx(0)
    setGenError(null)

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jobId, error: rpcErr } = await (supabase as any).rpc('trigger_short_book_generation', {
        p_senior_id: user.id,
        p_utterance_ids: topic.utterance_ids,
        p_topic_title: topic.title,
      })

      if (rpcErr) throw new Error(rpcErr.message)

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('로그인이 필요합니다')

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-book`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ job_id: jobId }),
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `단편 생성 실패 (${res.status})`)
      }

      await refresh()
      setShortGenerating(false)

      // generate-book은 cover 호출 예약 후 즉시 반환하므로
      // 이 시점에 책은 'draft' 상태일 수 있음 (generate-cover가 'editing'으로 변경)
      const { data: newBook } = await supabase
        .from('books')
        .select('id')
        .eq('senior_id', user.id)
        .eq('book_type', 'short')
        .in('status', ['draft', 'editing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (newBook) navigate(`/s/books/${newBook.id}/edit`)

    } catch (err) {
      setShortGenerating(false)
      setGenError(err instanceof Error ? err.message : '오류가 발생했어요')
    }
  }, [user, navigate, refresh])

  // 월간 책 생성 중 단계 메시지 순환 (12초마다)
  useEffect(() => {
    if (!generating) return
    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, MONTHLY_STEP_MESSAGES.length - 1))
    }, 12000)
    return () => clearInterval(timer)
  }, [generating])

  // 단편 책 생성 중 단계 메시지 순환 (12초마다)
  useEffect(() => {
    if (!shortGenerating) return
    const timer = setInterval(() => {
      setShortStepIdx((i) => Math.min(i + 1, SHORT_STEP_MESSAGES.length - 1))
    }, 12000)
    return () => clearInterval(timer)
  }, [shortGenerating])

  const hasNoBooks = monthlyBooks.length === 0 && shortBooks.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">집필실</h1>
        {/* 버튼 2개: 월간 책 / 단편 책 독립 생성 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTopicModalOpen(true)}
            disabled={!!shortDraftBook}
            className="flex items-center gap-1.5 bg-yellow-400 rounded-xl px-3 py-2.5 min-h-11 disabled:opacity-40"
          >
            <BookOpen size={15} className="text-gray-900" />
            <span className="text-sm text-gray-900">단편 만들기</span>
          </button>
          <button
            type="button"
            onClick={() => setMonthModalOpen(true)}
            disabled={!!monthlyDraftBook}
            className="flex items-center gap-1.5 bg-[#E8820C] rounded-xl px-3 py-2.5 min-h-11 disabled:opacity-40"
          >
            <BookOpen size={15} className="text-white" />
            <span className="text-sm text-white">월간 만들기</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-6 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-base text-[#6B7280]">불러오는 중...</span>
          </div>
        )}

        {!loading && hasNoBooks && (
          <div className="flex items-center justify-center py-12">
            <span className="text-base text-[#6B7280]">아직 만들어진 책이 없어요</span>
          </div>
        )}

        {/* ── 월간 회고 섹션 ───────────────────────────────────── */}
        {!loading && (monthlyDraftBook || publishedMonthly.length > 0) && (
          <section className="flex flex-col gap-3">
            <p className="text-base font-semibold text-[#1F2937] px-1">월간 회고</p>

            {/* 작성 중인 월간 책 */}
            {monthlyDraftBook && (
              <DraftBookCard
                book={monthlyDraftBook}
                onContinue={() => navigate(`/s/books/${monthlyDraftBook.id}/edit`)}
              />
            )}

            {/* 출간된 월간 책 */}
            {publishedMonthly.length > 0 && (
              <div className="flex flex-col gap-3">
                {publishedMonthly.length > 0 && (
                  <p className="text-sm text-[#6B7280] px-1">출간된 책 {publishedMonthly.length}권</p>
                )}
                {publishedMonthly.map((book) => (
                  <PublishedBookCard
                    key={book.id}
                    book={book}
                    onEdit={() => navigate(`/s/books/${book.id}/edit`)}
                    onDelete={() => setDeleteTarget({ id: book.id, title: book.title })}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── 단편 이야기 섹션 ─────────────────────────────────── */}
        {!loading && (shortDraftBook || publishedShorts.length > 0) && (
          <section className="flex flex-col gap-3">
            <p className="text-base font-semibold text-[#1F2937] px-1">단편 이야기</p>

            {/* 작성 중인 단편 책 */}
            {shortDraftBook && (
              <DraftBookCard
                book={shortDraftBook}
                onContinue={() => navigate(`/s/books/${shortDraftBook.id}/edit`)}
                label="단편"
                accentColor="#FACC15"
                isShort
              />
            )}

            {/* 출간된 단편 책 */}
            {publishedShorts.length > 0 && (
              <div className="flex flex-col gap-3">
                {publishedShorts.length > 0 && (
                  <p className="text-sm text-[#6B7280] px-1">출간된 단편 {publishedShorts.length}권</p>
                )}
                {publishedShorts.map((book) => (
                  <PublishedBookCard
                    key={book.id}
                    book={book}
                    onEdit={() => navigate(`/s/books/${book.id}/edit`)}
                    onDelete={() => setDeleteTarget({ id: book.id, title: book.title })}
                    isShort
                  />
                ))}
              </div>
            )}
          </section>
        )}

      </main>

      {/* ── 책 삭제 확인 모달 ────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => !deleting && setDeleteTarget(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
            <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">책을 삭제할까요?</p>
            <p className="text-[1.0625rem] text-[#6B7280] text-center">
              <span className="font-medium text-[#1F2937]">"{deleteTarget.title}"</span>
            </p>
            <p className="text-base text-[#9CA3AF] text-center">삭제하면 되돌릴 수 없어요</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 bg-[#F3F4F6] rounded-xl py-3 text-center min-h-11 disabled:opacity-40">
                <span className="text-[1.125rem] text-[#6B7280]">취소</span>
              </button>
              <button type="button" onClick={handleDeleteBook} disabled={deleting}
                className="flex-1 bg-[#EF4444] rounded-xl py-3 text-center min-h-11 disabled:opacity-50">
                <span className="text-[1.125rem] text-white">{deleting ? '삭제 중…' : '삭제'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 단편 책 주제 선택 모달 ───────────────────────────── */}
      {user && (
        <TopicSelectionModal
          isOpen={topicModalOpen}
          onClose={() => setTopicModalOpen(false)}
          seniorId={user.id}
          onSelect={handleCreateShortBook}
        />
      )}

      {/* ── 연/월 선택 모달 (월간 책) ────────────────────────── */}
      {monthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMonthModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm z-10 flex flex-col gap-5 px-6 py-6">

            <div className="flex items-center justify-between">
              <p className="text-[1.125rem] font-bold text-[#1F2937]">어느 달 이야기를 만들까요?</p>
              <button
                type="button"
                onClick={() => setMonthModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center"
              >
                <X size={16} className="text-[#6B7280]" />
              </button>
            </div>

            {/* 연도 선택 */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectYear((y) => y - 1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#F3F4F6]"
              >
                <ChevronLeft size={20} className="text-[#6B7280]" />
              </button>
              <span className="text-[1.25rem] font-bold text-[#1F2937]">{selectYear}년</span>
              <button
                type="button"
                onClick={() => setSelectYear((y) => Math.min(y + 1, now.getFullYear()))}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#F3F4F6]"
              >
                <ChevronRight size={20} className="text-[#6B7280]" />
              </button>
            </div>

            {/* 월 선택 그리드 */}
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const isFuture =
                  selectYear > now.getFullYear() ||
                  (selectYear === now.getFullYear() && m > now.getMonth() + 1)
                const isSelected = m === selectMonth
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={isFuture}
                    onClick={() => setSelectMonth(m)}
                    className={[
                      'rounded-xl py-2.5 text-base font-medium transition-colors',
                      isSelected ? 'bg-[#E8820C] text-white' : 'bg-[#F3F4F6] text-[#1F2937]',
                      isFuture ? 'opacity-30 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {m}월
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleCreateBook}
              className="w-full bg-[#E8820C] rounded-xl py-3.5 text-[1.0625rem] text-white font-medium"
            >
              이 달 이야기 만들기
            </button>
          </div>
        </div>
      )}

      {/* ── 월간 책 생성 오버레이 ─────────────────────────────── */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90">
          <Loader2 size={48} className="text-[#E8820C] animate-spin mb-6" />
          <p className="text-[1.125rem] font-bold text-[#1F2937] mb-2">
            {selectYear}년 {selectMonth}월 이야기책 만드는 중
          </p>
          <p className="text-base text-[#6B7280]">{MONTHLY_STEP_MESSAGES[stepIdx]}</p>
          <p className="text-sm text-[#9CA3AF] mt-4">몇 분 정도 걸릴 수 있어요</p>
        </div>
      )}

      {/* ── 단편 책 생성 오버레이 ─────────────────────────────── */}
      {shortGenerating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90">
          <Loader2 size={48} className="text-yellow-500 animate-spin mb-6" />
          <p className="text-[1.125rem] font-bold text-[#1F2937] mb-2">단편 이야기책 만드는 중</p>
          <p className="text-base text-[#6B7280]">{SHORT_STEP_MESSAGES[shortStepIdx]}</p>
          <p className="text-sm text-[#9CA3AF] mt-4">몇 분 정도 걸릴 수 있어요</p>
        </div>
      )}

      {/* ── 에러 토스트 ───────────────────────────────────────── */}
      {genError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] text-white text-sm rounded-xl px-5 py-3 flex items-center gap-3 max-w-xs">
          <span className="flex-1">{genError}</span>
          <button type="button" onClick={() => setGenError(null)}>
            <X size={14} className="text-white" />
          </button>
        </div>
      )}

    </div>
  )
}

// 작성 중인 책 카드 (월간/단편 공용)
function DraftBookCard({
  book,
  onContinue,
  label = '작성 중',
  accentColor = '#E8820C',
  isShort = false,
}: {
  book: { id: string; title: string; year: number; month: number; chapterCount: number }
  onContinue: () => void
  label?: string
  accentColor?: string
  isShort?: boolean
}) {
  const palette = isShort ? SHORT_BOOK_PALETTE : getPalette(book.month)
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: `2px solid ${accentColor}` }}>
      <div className="flex items-stretch gap-4 px-5 py-4">
        {/* 책 표지 썸네일 — 단편은 날짜·챕터 없으므로 더 낮은 min-h 사용 */}
        <div className={`relative w-[64px] shrink-0 ${isShort ? 'min-h-[76px]' : 'min-h-[96px]'}`}>
          <div
            className="absolute inset-0 rounded-lg flex flex-col items-center justify-center"
            style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
          >
            <p className="text-[11px] font-medium" style={{ color: palette.textColor }}>{isShort ? '단편' : `${book.month}월`}</p>
          </div>
          <div
            className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg opacity-35"
            style={{ backgroundColor: palette.accent }}
          />
        </div>

        {/* 책 정보 */}
        <div className="flex-1 flex flex-col justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-[1.25rem] text-[#1F2937]">{book.title}</p>
              <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${accentColor}20` }}>
                <span className="text-xs" style={{ color: accentColor }}>{label}</span>
              </span>
            </div>
            {/* 단편은 날짜·챕터 수 미표시 */}
            {!isShort && (
              <>
                <p className="text-base text-[#6B7280]">{book.year}년 {book.month}월</p>
                <p className="text-base text-[#6B7280]">챕터 {book.chapterCount}개</p>
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="w-full py-3 flex items-center justify-center gap-2"
        style={{ backgroundColor: accentColor }}
      >
        <Edit3 size={16} className="text-white" />
        <span className="text-[1.0625rem] text-white">이어서 쓰기</span>
      </button>
    </div>
  )
}

// 출간된 책 카드 (월간/단편 공용)
function PublishedBookCard({
  book,
  onEdit,
  onDelete,
  isShort = false,
}: {
  book: { id: string; title: string; year: number; month: number; chapterCount: number }
  onEdit: () => void
  onDelete?: () => void
  isShort?: boolean
}) {
  const palette = isShort ? SHORT_BOOK_PALETTE : getPalette(book.month)
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl flex items-stretch gap-4 px-5 py-4">
      {/* 책 표지 썸네일 */}
      <div className="relative w-[56px] shrink-0">
        <div
          className="w-full h-full rounded-lg py-3 flex flex-col items-center justify-center gap-0 min-h-[72px]"
          style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
        >
          {/* 단편은 "단편" 표기, 월간은 "n월" 표기 */}
          <p className="text-[10px]" style={{ color: palette.textColor }}>{isShort ? '단편' : `${book.month}월`}</p>
        </div>
        <div
          className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg opacity-35"
          style={{ backgroundColor: palette.accent }}
        />
      </div>

      {/* 정보 */}
      <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
        <p className="text-[1.0625rem] text-[#1F2937]">{book.title}</p>
        {/* 단편은 날짜·챕터 수 미표시 */}
        {!isShort && (
          <>
            <p className="text-sm text-[#6B7280]">{book.year}년 {book.month}월</p>
            <p className="text-sm text-[#6B7280]">챕터 {book.chapterCount}개</p>
          </>
        )}
      </div>

      {/* 편집 / 삭제 버튼 */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="bg-[#F3F4F6] rounded-xl px-3 py-2 min-h-11 flex items-center gap-1"
        >
          <Edit3 size={14} className="text-[#6B7280]" />
          <span className="text-sm text-[#6B7280]">편집</span>
        </button>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="bg-[#FEE2E2] rounded-xl px-3 py-2 min-h-11 flex items-center gap-1"
          >
            <Trash2 size={14} className="text-[#EF4444]" />
            <span className="text-sm text-[#EF4444]">삭제</span>
          </button>
        )}
      </div>
    </div>
  )
}
