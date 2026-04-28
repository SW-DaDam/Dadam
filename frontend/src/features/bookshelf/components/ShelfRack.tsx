import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { BookWithStats } from '@/types/domain'
import type { BookStatus } from '@/types/domain'

const PALETTE = [
  { bg: '#FFF0DC', border: '#E8820C', accent: '#E8820C', text: '#E8820C' },
  { bg: '#DCFCE7', border: '#16A34A', accent: '#16A34A', text: '#16A34A' },
  { bg: '#FEF9C3', border: '#CA8A04', accent: '#CA8A04', text: '#CA8A04' },
  { bg: '#E0F2FE', border: '#0369A1', accent: '#0369A1', text: '#0369A1' },
  { bg: '#F3E8FF', border: '#7C3AED', accent: '#7C3AED', text: '#7C3AED' },
  { bg: '#FCE7F3', border: '#BE185D', accent: '#BE185D', text: '#BE185D' },
]

function paletteFor(month: number) {
  return PALETTE[(month - 1) % PALETTE.length]
}

function progressLabel(status: BookStatus): string | null {
  if (status === 'draft') return '집필 중'
  if (status === 'editing') return '편집 중'
  return null
}

// ─── BookSpine ──────────────────────────────────────────────────

interface BookSpineProps {
  book: BookWithStats
  isNewest: boolean
  navPath: string
}

type PullState = 'idle' | 'grip' | 'pulled'

function BookSpine({ book, isNewest, navPath }: BookSpineProps) {
  const navigate = useNavigate()
  const [pullState, setPullState] = useState<PullState>('idle')
  const c = paletteFor(book.month)
  const label = progressLabel(book.status)
  const isDraft = label !== null

  function handleTap() {
    if (isDraft) return
    setPullState('grip')
    setTimeout(() => setPullState('pulled'), 90)
    setTimeout(() => {
      setPullState('idle')
      navigate(navPath)
    }, 400)
  }

  const transforms: Record<PullState, string> = {
    idle:   'translateY(0px)   rotate(0deg)  scale(1)',
    grip:   'translateY(-6px)  rotate(-3deg) scale(0.96)',
    pulled: 'translateY(-46px) rotate(0deg)  scale(1.05)',
  }
  const shadows: Record<PullState, string> = {
    idle:   '1px 2px 4px rgba(0,0,0,0.10)',
    grip:   '2px 6px 10px rgba(0,0,0,0.18)',
    pulled: '6px 20px 32px rgba(0,0,0,0.35)',
  }
  const transitions: Record<PullState, string> = {
    idle:   'transform 0.18s ease-in, box-shadow 0.18s ease-in',
    grip:   'transform 0.09s ease-out, box-shadow 0.09s ease-out',
    pulled: 'transform 0.28s cubic-bezier(0.34, 1.5, 0.64, 1), box-shadow 0.28s ease',
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      disabled={isDraft}
      aria-label={isDraft ? `${book.month}월 ${label}` : `${book.title} 읽기`}
      className="relative flex-1 min-w-[40px] max-w-[54px] h-[112px] rounded-sm flex flex-col items-center justify-center"
      style={{
        backgroundColor: isDraft ? '#EFEFEF' : c.bg,
        border: `2px ${isDraft ? 'dashed #D1D5DB' : `solid ${c.border}`}`,
        transform: transforms[pullState],
        transition: transitions[pullState],
        boxShadow: shadows[pullState],
      }}
    >
      {/* 왼쪽 세로 accent 줄 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-sm"
        style={{ backgroundColor: isDraft ? '#D1D5DB' : c.accent, opacity: 0.5 }}
      />

      {isDraft ? (
        <p
          className="text-[9px] text-[#9CA3AF] font-medium"
          style={{ writingMode: 'vertical-rl' }}
        >
          {label}
        </p>
      ) : (
        <div className="flex flex-col items-center gap-1 px-1">
          {/* NEW / 댓글 뱃지 */}
          {isNewest ? (
            <span
              className="text-[7px] font-bold text-white px-1 py-0.5 rounded leading-none"
              style={{ backgroundColor: c.accent }}
            >
              N
            </span>
          ) : book.commentCount > 0 ? (
            <span
              className="text-[7px] font-bold text-white px-1 py-0.5 rounded leading-none"
              style={{ backgroundColor: c.accent }}
            >
              {book.commentCount}
            </span>
          ) : <span className="h-4" />}

          {/* 책 제목 세로 텍스트 */}
          <p
            className="font-bold text-[11px] leading-tight overflow-hidden"
            style={{
              color: c.text,
              writingMode: 'vertical-rl',
              maxHeight: '64px',
            }}
          >
            {book.title}
          </p>

          {/* 연도 */}
          <p
            className="text-[8px] opacity-60"
            style={{ color: c.text, writingMode: 'vertical-rl' }}
          >
            {book.year}
          </p>
        </div>
      )}
    </button>
  )
}

// ─── InProgress Placeholder ─────────────────────────────────────

function InProgressPlaceholder() {
  return (
    <div
      className="relative flex-1 flex items-center justify-center min-w-[40px] max-w-[54px] h-[112px] rounded-sm"
      style={{ backgroundColor: '#F3F4F6', border: '2px dashed #D1D5DB' }}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-sm bg-[#D1D5DB] opacity-40" />
      <p
        className="text-[9px] text-[#9CA3AF] font-medium"
        style={{ writingMode: 'vertical-rl' }}
      >
        집필 중
      </p>
    </div>
  )
}

// ─── ShelfRow ────────────────────────────────────────────────────

function ShelfRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      {/* 책이 뽑힐 때 위로 올라갈 공간 */}
      <div className="flex gap-2 px-3 pt-10 pb-1 overflow-x-auto">
        {children}
      </div>
      {/* 나무 선반 */}
      <div className="h-4 mx-1 rounded-sm" style={{ backgroundColor: '#B8956A' }} />
      <div className="h-1.5 mx-1 rounded-b-sm" style={{ backgroundColor: '#9E7A52' }} />
    </div>
  )
}

// ─── ShelfRack (public) ──────────────────────────────────────────

interface ShelfRackProps {
  books: BookWithStats[]
  loading?: boolean
  getNavPath?: (book: BookWithStats) => string
  showInProgressPlaceholder?: boolean
  rowSize?: number
}

export function ShelfRack({
  books,
  loading = false,
  getNavPath,
  showInProgressPlaceholder = false,
  rowSize = 4,
}: ShelfRackProps) {
  const resolveNavPath = getNavPath ?? ((b: BookWithStats) => `/r/books/${b.id}`)

  const newestPublishedId = books.find((b) => b.status === 'published')?.id

  const now = new Date()
  const hasCurrentMonthPublished = books.some(
    (b) =>
      b.status === 'published' &&
      b.year === now.getFullYear() &&
      b.month === now.getMonth() + 1,
  )
  const needsPlaceholder = showInProgressPlaceholder && !hasCurrentMonthPublished

  const sorted = [
    ...books.filter((b) => b.status !== 'published'),
    ...books.filter((b) => b.status === 'published'),
  ]

  const rows: BookWithStats[][] = []
  for (let i = 0; i < sorted.length; i += rowSize) {
    rows.push(sorted.slice(i, i + rowSize))
  }
  if (rows.length === 0) rows.push([])

  if (loading) {
    return (
      <div className="flex flex-col rounded-xl overflow-hidden" style={{ backgroundColor: '#F5E6D0' }}>
        <div className="flex gap-2 px-3 pt-10 pb-1">
          {Array.from({ length: rowSize }).map((_, i) => (
            <div key={i} className="flex-1 h-[112px] rounded-sm bg-[#E5E7EB] animate-pulse" />
          ))}
        </div>
        <div className="h-4 mx-1 rounded-sm" style={{ backgroundColor: '#B8956A' }} />
        <div className="h-1.5 mx-1 rounded-b-sm" style={{ backgroundColor: '#9E7A52' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl overflow-hidden" style={{ backgroundColor: '#F5E6D0' }}>
      {rows.map((row, rowIdx) => {
        const slotsFilled = row.length + (rowIdx === 0 && needsPlaceholder ? 1 : 0)
        const emptySlots = Math.max(0, rowSize - slotsFilled)

        return (
          <ShelfRow key={rowIdx}>
            {rowIdx === 0 && needsPlaceholder && <InProgressPlaceholder />}
            {row.map((book) => (
              <BookSpine
                key={book.id}
                book={book}
                isNewest={book.id === newestPublishedId}
                navPath={resolveNavPath(book)}
              />
            ))}
            {Array.from({ length: emptySlots }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1 min-w-[40px] max-w-[54px]" />
            ))}
          </ShelfRow>
        )
      })}
    </div>
  )
}
