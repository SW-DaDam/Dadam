import { useNavigate } from 'react-router'
import { UserPlus } from 'lucide-react'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'
import { ShelfRack } from '@/features/bookshelf/components/ShelfRack'
import { useAuthStore } from '@/shared/stores/authStore'
import type { BookWithStats } from '@/types/domain'

export default function FamilyBookshelfPage() {
  const navigate = useNavigate()
  const { books, loading } = useBookshelf()
  const profile = useAuthStore((s) => s.profile)
  const shelfTitle = `${profile?.display_name ?? '나'}의 책장`

  const latestDraft = books.find((b) => b.status === 'draft' || b.status === 'editing')
  const publishedBooks = books.filter((b) => b.status === 'published')
  const latestPublished = publishedBooks[0]

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
      <main className="flex flex-col gap-4 pt-4 pb-6 w-full max-w-2xl mx-auto">

        {/* 집필/편집 중 진행 카드 */}
        {latestDraft && (
          <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
            <p className="text-[1.25rem] font-bold text-[#1F2937]">이번 달 내 책</p>
            <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
              <div className="h-full bg-[#E8820C] rounded-full" style={{ width: '60%' }} />
            </div>
            <p className="text-base text-[#6B7280]">
              {latestDraft.status === 'editing' ? '편집 중이에요' : '집필 중이에요 · 월말에 완성돼요'}
            </p>
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

        {/* 최신 출간작 바로가기 */}
        {!latestDraft && latestPublished && (
          <div className="mx-4 sm:mx-6 bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
            <p className="text-[1.25rem] font-bold text-[#1F2937]">최근 출간작</p>
            <p className="text-base text-[#6B7280]">{latestPublished.title}</p>
            <button
              type="button"
              onClick={() => navigate(`/s/books/${latestPublished.id}`)}
              className="w-full bg-[#FFF0DC] rounded-xl py-3 text-center"
            >
              <span className="text-[1.125rem] text-[#E8820C]">책 미리보기</span>
            </button>
          </div>
        )}

        {/* 책장 */}
        <div className="mx-3 sm:mx-5">
          <ShelfRack
            books={books}
            loading={loading}
            getNavPath={seniorNavPath}
            showInProgressPlaceholder={false}
            rowSize={6}
          />
        </div>

        {/* 출간된 책이 없을 때 */}
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
