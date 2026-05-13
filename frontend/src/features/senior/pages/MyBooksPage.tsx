import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Plus, Edit3, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'

// 월 번호 → 표지 색상 팔레트 (월 % 4 기준 순환)
const COVER_PALETTES = [
  { bg: '#FFF0DC', border: '#E8820C', accent: '#E8820C', textColor: '#E8820C' },
  { bg: '#DCFCE7', border: '#16A34A', accent: '#16A34A', textColor: '#16A34A' },
  { bg: '#FEF9C3', border: '#CA8A04', accent: '#CA8A04', textColor: '#CA8A04' },
  { bg: '#F3F4F6', border: '#E5E7EB', accent: '#9CA3AF', textColor: '#6B7280' },
]

// 생성 중 단계별 안내 문구
const STEP_MESSAGES = [
  '이달의 이야기를 모으고 있어요...',
  '챕터를 구성하고 있어요...',
  '책 표지를 그리고 있어요...',
  '마무리 중이에요...',
]

function getPalette(month: number) {
  return COVER_PALETTES[(month - 1) % COVER_PALETTES.length]
}

export default function MyBooksPage() {
  const navigate = useNavigate()
  const { books, loading, refresh } = useBookshelf()
  const user = useAuthStore((s) => s.user)

  // 연/월 선택 모달
  const now = new Date()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectYear, setSelectYear] = useState(now.getFullYear())
  const [selectMonth, setSelectMonth] = useState(now.getMonth() + 1)

  // 생성 진행 오버레이
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [stepIdx, setStepIdx] = useState(0)

  // 새 책 만들기: RPC → Edge Function 호출 → 완료까지 폴링
  const handleCreateBook = useCallback(async () => {
    if (!user) return
    setModalOpen(false)
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

      // generate-book Edge Function을 anon 세션 토큰으로 호출 (job_id 전달)
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

      // 409: 해당 월에 이미 진행 중인 job이 있음 → 선택한 연/월 책으로 이동
      if (res.status === 409) {
        setGenerating(false)
        const { data: existingBook } = await supabase
          .from('books')
          .select('id')
          .eq('senior_id', user.id)
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
        throw new Error(body.error ?? `책 생성 실패 (${res.status})`)
      }

      // 완료 — 책 목록 갱신 후 editing 상태 책으로 이동
      await refresh()
      setGenerating(false)
      // 갱신된 books에서 editing 책 찾기 (state 업데이트 비동기라 직접 쿼리)
      const { data: newBook } = await supabase
        .from('books')
        .select('id')
        .eq('senior_id', user.id)
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

  // 생성 중 단계 메시지 순환 (4초마다)
  useEffect(() => {
    if (!generating) return
    const timer = setInterval(() => {
      setStepIdx((i) => Math.min(i + 1, STEP_MESSAGES.length - 1))
    }, 12000)
    return () => clearInterval(timer)
  }, [generating])

  // draft/editing 상태 = 작성 중, published = 출간됨
  const draftBook = books.find((b) => b.status === 'draft' || b.status === 'editing')
  const publishedBooks = books.filter((b) => b.status === 'published')

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <h1 className="text-lg sm:text-xl text-[#1F2937] font-medium">내 책장</h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!!draftBook}
          className="flex items-center gap-1.5 bg-[#E8820C] rounded-xl px-4 py-2.5 min-h-11 disabled:opacity-40"
        >
          <Plus size={16} className="text-white" />
          <span className="text-sm text-white">새 책 만들기</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="text-base text-[#6B7280]">불러오는 중...</span>
          </div>
        )}

        {!loading && books.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-base text-[#6B7280]">아직 만들어진 책이 없어요</span>
          </div>
        )}

        {/* 작성 중인 책 */}
        {!loading && draftBook && (() => {
          const palette = getPalette(draftBook.month)
          const monthLabel = `${draftBook.month}월`
          return (
            <div className="flex flex-col gap-2">
              <p className="text-base text-[#6B7280] px-1">작성 중인 책</p>
              <div className="bg-white border-2 border-[#E8820C] rounded-2xl overflow-hidden">
                <div className="flex items-stretch gap-4 px-5 py-4">
                  {/* 책 표지 */}
                  <div className="relative w-[64px] shrink-0">
                    <div
                      className="w-full rounded-lg py-4 flex flex-col items-center gap-0"
                      style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
                    >
                      <p className="text-xs" style={{ color: palette.textColor }}>
                        {draftBook.title.slice(0, 3)}
                      </p>
                      <p className="text-xs" style={{ color: palette.textColor }}>
                        {draftBook.title.slice(3)}
                      </p>
                      <p className="text-[10px] text-[#6B7280] mt-1">{monthLabel}</p>
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
                        <p className="text-[1.25rem] text-[#1F2937]">{draftBook.title}</p>
                        <span className="rounded-full px-2 py-0.5 bg-[#FFF0DC]">
                          <span className="text-xs text-[#E8820C]">작성 중</span>
                        </span>
                      </div>
                      <p className="text-base text-[#6B7280]">{draftBook.year}년 {draftBook.month}월</p>
                      <p className="text-base text-[#6B7280]">챕터 {draftBook.chapterCount}개</p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(`/s/books/${draftBook.id}/edit`)}
                  className="w-full bg-[#E8820C] py-3 flex items-center justify-center gap-2"
                >
                  <Edit3 size={16} className="text-white" />
                  <span className="text-[1.0625rem] text-white">이어서 쓰기</span>
                </button>
              </div>
            </div>
          )
        })()}

        {/* 출간된 책 */}
        {!loading && publishedBooks.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280] px-1">출간된 책 {publishedBooks.length}권</p>
            <div className="flex flex-col gap-3">
              {publishedBooks.map((book) => {
                const palette = getPalette(book.month)
                return (
                  <div
                    key={book.id}
                    className="bg-white border border-[#E5E7EB] rounded-2xl flex items-stretch gap-4 px-5 py-4"
                  >
                    {/* 책 표지 */}
                    <div className="relative w-[56px] shrink-0">
                      <div
                        className="w-full h-full rounded-lg py-3 flex flex-col items-center justify-center gap-0 min-h-[72px]"
                        style={{ backgroundColor: palette.bg, border: `1.5px solid ${palette.border}` }}
                      >
                        <p className="text-[10px]" style={{ color: palette.textColor }}>
                          {book.month}월
                        </p>
                      </div>
                      <div
                        className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg opacity-35"
                        style={{ backgroundColor: palette.accent }}
                      />
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 flex flex-col justify-center gap-0.5 min-w-0">
                      <p className="text-[1.0625rem] text-[#1F2937]">{book.title}</p>
                      <p className="text-sm text-[#6B7280]">{book.year}년 {book.month}월</p>
                      <p className="text-sm text-[#6B7280]">챕터 {book.chapterCount}개</p>
                    </div>

                    {/* 편집 버튼 */}
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/s/books/${book.id}/edit`)}
                        className="bg-[#F3F4F6] rounded-xl px-3 py-2 min-h-11 flex items-center gap-1"
                      >
                        <Edit3 size={14} className="text-[#6B7280]" />
                        <span className="text-sm text-[#6B7280]">편집</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </main>

      {/* ── 연/월 선택 모달 ──────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm z-10 flex flex-col gap-5 px-6 py-6">

            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <p className="text-[1.125rem] font-bold text-[#1F2937]">어느 달 이야기를 만들까요?</p>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
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
                // 미래 연/월은 선택 불가
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
                      isSelected
                        ? 'bg-[#E8820C] text-white'
                        : 'bg-[#F3F4F6] text-[#1F2937]',
                      isFuture ? 'opacity-30 cursor-not-allowed' : '',
                    ].join(' ')}
                  >
                    {m}월
                  </button>
                )
              })}
            </div>

            {/* 확인 버튼 */}
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

      {/* ── 생성 진행 오버레이 ─────────────────────────────────── */}
      {generating && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90">
          <Loader2 size={48} className="text-[#E8820C] animate-spin mb-6" />
          <p className="text-[1.125rem] font-bold text-[#1F2937] mb-2">
            {selectYear}년 {selectMonth}월 이야기책 만드는 중
          </p>
          <p className="text-base text-[#6B7280]">{STEP_MESSAGES[stepIdx]}</p>
          <p className="text-sm text-[#9CA3AF] mt-4">몇 분 정도 걸릴 수 있어요</p>
        </div>
      )}

      {/* ── 생성 오류 토스트 ──────────────────────────────────── */}
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
