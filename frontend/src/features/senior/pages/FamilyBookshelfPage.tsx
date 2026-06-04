import { useState } from 'react'
import { useNavigate } from 'react-router'
import { UserPlus, X } from 'lucide-react'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'
import { ShelfRack } from '@/features/bookshelf/components/ShelfRack'
import { useAuthStore } from '@/shared/stores/authStore'
import type { BookWithStats } from '@/types/domain'

export default function FamilyBookshelfPage() {
  const navigate = useNavigate()
  const { books, loading } = useBookshelf()
  const profile = useAuthStore((s) => s.profile)
  const shelfTitle = `${profile?.display_name ?? '나'}의 책장`

  const monthlyBooks = books.filter((b) => b.book_type === 'monthly')
  const shortBooks = books.filter((b) => b.book_type === 'short')

  const latestDraft = books.find((b) => b.status === 'draft' || b.status === 'editing')
  const publishedBooks = books.filter((b) => b.status === 'published')
  const latestPublished = publishedBooks[0]
  // 편집중인 책 카드 — X 클릭 시 세션 한정 숨김
  const [draftDismissed, setDraftDismissed] = useState(false)
  // 최근 출간작 카드 — X 또는 확인 클릭 시 숨김
  const [latestDismissed, setLatestDismissed] = useState(false)

  function seniorNavPath(book: BookWithStats) {
    return `/s/books/${book.id}`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <h1 className="text-[1.5rem] font-bold text-[#1F2937]">{shelfTitle}</h1>
        <button
          type="button"
          onClick={() => navigate('/s/family/invite')}
          className="bg-[#FFF0DC] rounded-xl px-4 py-2.5 flex items-center gap-1.5 min-h-11"
        >
          <UserPlus size={15} className="text-[#E8820C]" />
          <span className="text-sm text-[#E8820C]">초대</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
      <main className="flex flex-col gap-4 pt-4 pb-6 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 집필/편집 중 진행 카드 */}
        {latestDraft && !draftDismissed && (
          <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3 relative">
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setDraftDismissed(true)}
              className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white shadow-sm text-[#9CA3AF]"
            >
              <X size={13} />
            </button>
            <p className="text-[1.25rem] font-bold text-[#1F2937] truncate">
              {latestDraft.title}
              <span className="text-[1rem] font-normal text-[#6B7280]">
                {latestDraft.status === 'editing' ? ' (편집중)' : ' (초안 완료)'}
              </span>
            </p>
            <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#E8820C] rounded-full" style={{ width: '60%' }} />
            </div>
            {latestDraft.status === 'editing' && (
              <button
                type="button"
                onClick={() => navigate(`/s/books/${latestDraft.id}/edit`)}
                className="w-full bg-[#FFF0DC] rounded-xl py-3 text-center"
              >
                <span className="text-[1.125rem] text-[#E8820C]">책 편집하러 가기</span>
              </button>
            )}
          </div>
        )}

        {/* 최신 출간작 바로가기 — X 또는 확인 클릭 시 카드 숨김 */}
        {!latestDraft && latestPublished && !latestDismissed && (
          <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 relative">
            {/* X 닫기 버튼 — 카드 우측 최상단 */}
            <button
              type="button"
              onClick={() => setLatestDismissed(true)}
              className="absolute -top-2 -right-2 p-1.5 rounded-full hover:bg-gray-100 bg-white shadow-sm text-[#9CA3AF]"
              aria-label="닫기"
            >
              <X size={13} />
            </button>
            <div className="flex items-center justify-between gap-3 pr-5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-[1.125rem] font-bold text-[#1F2937]">최근 출간작</p>
                <p className="text-base text-[#6B7280] truncate">{latestPublished.title}</p>
              </div>
              <button
                type="button"
                onClick={() => { setLatestDismissed(true); navigate(`/s/books/${latestPublished.id}`) }}
                className="shrink-0 bg-[#FFF0DC] rounded-xl px-4 py-2 min-h-10 translate-x-[6px]"
              >
                <span className="text-base text-[#E8820C] font-medium">확인</span>
              </button>
            </div>
          </div>
        )}

        {/* 월간 회고 책장 */}
        {(loading || monthlyBooks.length > 0) && (
          <div className="mx-3 sm:mx-5 flex flex-col gap-2">
            <p className="text-[1.125rem] font-bold text-[#1F2937] px-1">월간 회고</p>
            <ShelfRack
              books={monthlyBooks}
              loading={loading}
              getNavPath={seniorNavPath}
              showInProgressPlaceholder={false}
              rowSize={4}
            />
          </div>
        )}

        {/* 단편 이야기 책장 */}
        {(loading || shortBooks.length > 0) && (
          <div className="mx-3 sm:mx-5 flex flex-col gap-2">
            <p className="text-[1.125rem] font-bold text-[#1F2937] px-1">단편 이야기</p>
            <ShelfRack
              books={shortBooks}
              loading={loading}
              getNavPath={seniorNavPath}
              showInProgressPlaceholder={false}
              rowSize={4}
            />
          </div>
        )}

        {/* 책이 하나도 없을 때 */}
        {!loading && books.length === 0 && (
          <div className="mx-4 sm:mx-6 flex flex-col items-center gap-2 py-10">
            <p className="text-[1.125rem] text-[#6B7280]">아직 책이 없어요</p>
            <p className="text-base text-[#9CA3AF]">AI 말동무와 대화하면 책이 만들어져요</p>
          </div>
        )}

      </main>
      </div>
    </div>
  )
}
