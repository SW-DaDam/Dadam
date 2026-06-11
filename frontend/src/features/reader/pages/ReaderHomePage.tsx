import { useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { useFamilyBookshelf } from '@/features/bookshelf/hooks/useFamilyBookshelf'
import { ShelfRack } from '@/features/bookshelf/components/ShelfRack'
import { josa } from '@/lib/utils'
import type { BookWithStats } from '@/types/domain'

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}

export default function ReaderHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '사용자'
  const { books, seniorName, loading } = useFamilyBookshelf()
  const [latestDismissed, setLatestDismissed] = useState(false)
  const isConnected = !!seniorName
  const seniorLabel = seniorName || '어르신'
  const latestBook = books[0] ?? null

  function getNavPath(book: BookWithStats) {
    return `/r/books/${book.id}`
  }

  return (
    <div className="flex flex-col h-full">
      <header className="w-full min-h-[72px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 py-3 gap-3 shrink-0">
        <span className="flex-1 min-w-0 truncate text-lg text-[#6B7280]">{todayLabel()}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 sm:px-6 py-4 w-full max-w-2xl md:max-w-none mx-auto">
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0" aria-hidden="true">
            <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C">
              <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
            </svg>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">{displayName} 님, 반가워요 :)</p>
            <p className="text-base text-[#6B7280]">
              {loading
                ? '책장을 불러오는 중이에요'
                : !isConnected
                  ? '어르신과 연결하면 책을 읽을 수 있어요'
                  : latestBook
                    ? `${seniorLabel}${josa(seniorLabel, '이', '가')} 새 책을 출간했어요. 읽어보셨나요?`
                    : `${seniorLabel}${josa(seniorLabel, '이', '가')} 책을 준비 중이에요`}
            </p>
          </div>
        </div>

        {!loading && !isConnected && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-8 flex flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden="true">📬</span>
            <p className="text-[1.125rem] text-[#1F2937]">아직 연결된 어르신이 없어요</p>
            <p className="text-base text-[#6B7280]">어르신에게 초대 링크를 받아 연결하면<br />책장과 댓글을 이용할 수 있어요</p>
          </div>
        )}

        {loading && (
          <div className="bg-white border-2 border-[#E5E7EB] rounded-2xl px-5 py-5 animate-pulse">
            <div className="h-5 bg-[#F3F4F6] rounded w-1/2 mb-2" />
            <div className="h-4 bg-[#F3F4F6] rounded w-2/3" />
          </div>
        )}

        {!loading && latestBook && !latestDismissed && (
          <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl overflow-visible">
            <div className="absolute -top-3 left-5 bg-[#E8820C] rounded-lg px-3 py-1">
              <span className="text-sm text-white font-medium">NEW</span>
            </div>
            <button
              type="button"
              onClick={() => setLatestDismissed(true)}
              className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-white shadow-sm text-[#9CA3AF]"
              aria-label="새 책 알림 닫기"
            >
              <X size={13} />
            </button>

            <div className="flex items-stretch gap-4 px-5 pt-6 pb-5">
              <div className="relative w-[72px] shrink-0">
                {latestBook.cover_image_url ? (
                  <img src={latestBook.cover_image_url} alt={latestBook.title} className="w-full rounded-lg object-cover" />
                ) : (
                  <div className="w-full bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-lg py-4 flex flex-col items-center gap-0">
                    <p className="text-xs text-[#E8820C] text-center px-1 leading-tight">{latestBook.title}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{latestBook.month}월</p>
                  </div>
                )}
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E8820C] opacity-35 rounded-l-lg" />
              </div>
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-[1.25rem] text-[#1F2937]">{latestBook.title}</p>
                  <p className="text-base text-[#6B7280]">{latestBook.year}년 {latestBook.month}월</p>
                  <p className="text-base text-[#6B7280]">
                    챕터 {latestBook.chapter_count}개
                    {latestBook.dedication ? ' · 에필로그 포함' : ''}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/r/books/${latestBook.id}`)}
              className="w-full bg-[#E8820C] rounded-b-xl py-3 text-center min-h-11"
            >
              <span className="text-[1.125rem] text-white">지금 읽기</span>
            </button>
          </div>
        )}

        {(loading || isConnected) && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
            <p className="text-[1.25rem] text-[#1F2937]">{seniorLabel}의 책장</p>
            <ShelfRack books={books} loading={loading} getNavPath={getNavPath} showInProgressPlaceholder={false} rowSize={4} />
            {!loading && books.length === 0 && (
              <p className="text-base text-[#9CA3AF] text-center py-4">아직 출간된 책이 없어요</p>
            )}
          </div>
        )}

        {!loading && latestBook && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg">💬</div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-[1.125rem] text-[#1F2937]">{seniorLabel}에게 댓글을 남겨보세요</p>
              <p className="text-sm text-[#6B7280]">{latestBook.month}월 책에 소감을 남겨요</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/r/books/${latestBook.id}`)}
              className="bg-[#E8820C] rounded-xl px-3 py-2 shrink-0 min-h-11"
            >
              <span className="text-sm text-white">댓글 달러가기</span>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
