import { useState } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { useFamilyBookshelf } from '@/features/bookshelf/hooks/useFamilyBookshelf'
import { ShelfRack } from '@/features/bookshelf/components/ShelfRack'
import type { BookWithStats } from '@/types/domain'

export default function ReaderHomePage() {
  const navigate = useNavigate()
  const { books, seniorName, loading } = useFamilyBookshelf()
  const [latestDismissed, setLatestDismissed] = useState(false)

  const isConnected = !!seniorName
  const seniorLabel = seniorName || '저자'
  const monthlyBooks = books.filter((book) => book.book_type === 'monthly')
  const shortBooks = books.filter((book) => book.book_type === 'short')
  const latestPublished = books[0] ?? null

  function readerNavPath(book: BookWithStats) {
    return `/r/books/${book.id}`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <h1 className="text-[1.5rem] font-bold text-[#1F2937]">{seniorLabel}의 책장</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <main className="flex flex-col gap-4 pt-4 pb-6 w-full max-w-2xl md:max-w-none mx-auto">
          {!loading && !isConnected && (
            <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-8 flex flex-col items-center gap-3 text-center">
              <p className="text-[1.125rem] text-[#1F2937]">아직 연결된 저자가 없어요</p>
              <p className="text-base text-[#6B7280]">
                저자에게 초대 링크를 받아 연결하면
                <br />
                책장과 댓글을 이용할 수 있어요
              </p>
            </div>
          )}

          {/* 새 책 알림 — X 또는 확인 클릭 시 세션 동안 숨김 */}
          {!loading && latestPublished && !latestDismissed && (
            <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 relative">
              <button
                type="button"
                onClick={() => setLatestDismissed(true)}
                className="absolute -top-2 -right-2 p-1.5 rounded-full hover:bg-gray-100 bg-white shadow-sm text-[#9CA3AF]"
                aria-label="새 책 알림 닫기"
              >
                <X size={13} />
              </button>
              <div className="flex items-center justify-between gap-3 pr-5">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.125rem] font-bold text-[#1F2937]">새 책이 출간됐어요</p>
                  <p className="text-base text-[#6B7280] truncate">{latestPublished.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLatestDismissed(true)
                    navigate(`/r/books/${latestPublished.id}`)
                  }}
                  className="shrink-0 bg-[#FFF0DC] rounded-xl px-4 py-2 min-h-10 translate-x-[6px]"
                >
                  <span className="text-base text-[#E8820C] font-medium">확인</span>
                </button>
              </div>
            </div>
          )}

          {(loading || monthlyBooks.length > 0) && (
            <div className="mx-3 sm:mx-5 flex flex-col gap-2">
              <p className="text-[1.125rem] font-bold text-[#1F2937] px-1">월간 회고</p>
              <ShelfRack
                books={monthlyBooks}
                loading={loading}
                getNavPath={readerNavPath}
                showInProgressPlaceholder={false}
                rowSize={4}
              />
            </div>
          )}

          {(loading || shortBooks.length > 0) && (
            <div className="mx-3 sm:mx-5 flex flex-col gap-2">
              <p className="text-[1.125rem] font-bold text-[#1F2937] px-1">단편 이야기</p>
              <ShelfRack
                books={shortBooks}
                loading={loading}
                getNavPath={readerNavPath}
                showInProgressPlaceholder={false}
                rowSize={4}
              />
            </div>
          )}

          {!loading && isConnected && books.length === 0 && (
            <div className="mx-4 sm:mx-6 flex flex-col items-center gap-2 py-10">
              <p className="text-[1.125rem] text-[#6B7280]">아직 출간된 책이 없어요</p>
              <p className="text-base text-[#9CA3AF]">저자가 책을 준비하고 있어요</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
