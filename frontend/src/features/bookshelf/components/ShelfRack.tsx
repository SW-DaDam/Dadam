import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { BookWithStats } from '@/types/domain'
import type { BookStatus } from '@/types/domain'

const PALETTE = [
  { bg: '#C4614A', border: '#A84F3A' },
  { bg: '#7B5080', border: '#623E6A' },
  { bg: '#B85470', border: '#9A3E5A' },
  { bg: '#4A7A68', border: '#386050' },
  { bg: '#5A7A9A', border: '#486280' },
  { bg: '#9A7060', border: '#7A5848' },
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
      className="relative flex-1 min-w-[36px] max-w-[80px] h-[186px] rounded flex flex-col items-center justify-between pt-3 pb-2.5 px-1"
      style={{
        backgroundColor: isDraft ? '#E5E7EB' : c.bg,
        border: `1px solid ${isDraft ? '#D1D5DB' : c.border}`,
        transform: transforms[pullState],
        transition: transitions[pullState],
        boxShadow: shadows[pullState],
      }}
    >
      {isDraft ? (
        <p className="flex-1 flex items-center text-[11px] text-[#9CA3AF] font-medium" style={{ writingMode: 'vertical-rl' }}>
          {label}
        </p>
      ) : (
        <>
          {/* 상단 장식 라인 2개 */}
          <div className="w-full flex flex-col gap-[3px] px-1">
            <div className="h-[1.5px] rounded-full bg-white/50" />
            <div className="h-[1px] rounded-full bg-white/25" />
          </div>

          {/* NEW 뱃지 */}
          {isNewest && (
            <span className="absolute top-2 right-1.5 text-[9px] font-bold text-white bg-white/30 px-1 py-0.5 rounded leading-none">
              N
            </span>
          )}

          {/* 제목 */}
          <p
            className="flex-1 flex items-center font-bold text-[15px] leading-snug text-white overflow-hidden py-1"
            style={{
              writingMode: 'vertical-rl',
              letterSpacing: '0.04em',
              maxHeight: '96px',
            }}
          >
            {book.title}
          </p>

          {/* 연도 가로 표시 */}
          <p className="text-[10px] font-medium text-white/60 tracking-wide">
            {book.year}
          </p>
        </>
      )}
    </button>
  )
}

// ─── InProgress Placeholder ─────────────────────────────────────

function InProgressPlaceholder() {
  return (
    <div
      className="relative flex-1 flex items-center justify-center min-w-[36px] max-w-[80px] h-[186px] rounded-sm bg-[#F3F4F6] border-2 border-dashed border-[#D1D5DB]"
    >
      <div className="absolute left-0 top-0 bottom-0 w-[5px] rounded-l-sm bg-[#D1D5DB] opacity-40" />
      <p
        className="text-[11px] text-[#9CA3AF] font-medium"
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
      <div className="flex gap-3 px-4 pt-14 pb-1 overflow-x-auto">
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
      <div className="flex flex-col rounded-xl overflow-hidden bg-[#F5E6D0]">
        <div className="flex gap-3 px-4 pt-14 pb-1">
          {Array.from({ length: rowSize }).map((_, i) => (
            <div key={i} className="flex-1 h-[186px] rounded-sm bg-[#E5E7EB] animate-pulse" />
          ))}
        </div>
        <div className="h-4 mx-1 rounded-sm" style={{ backgroundColor: '#B8956A' }} />
        <div className="h-1.5 mx-1 rounded-b-sm" style={{ backgroundColor: '#9E7A52' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col rounded-xl overflow-hidden bg-[#F5E6D0]">
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
