import { useNavigate } from 'react-router'
import { Settings } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useBookshelf } from '@/features/bookshelf/hooks/useBookshelf'
import { ShelfRack } from '@/features/bookshelf/components/ShelfRack'

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}

const ACTIVITIES = [
  {
    id: 1,
    iconBg: '#FFF0DC',
    icon: '↩',
    iconColor: '#E8820C',
    title: '엄마가 내 댓글에 답장했어요',
    meta: '3월 책 · 챕터 2 · 30분 전',
    actionLabel: '답장 듣기 ›',
    actionBg: '#FFF0DC',
    actionColor: '#E8820C',
  },
  {
    id: 2,
    iconBg: '#DCFCE7',
    icon: '🖼',
    iconColor: '#16A34A',
    title: '이수빈이 3월 책에 사진을 추가했어요',
    meta: '3월 책 · 어제',
    actionLabel: '보러가기 ›',
    actionBg: '#F3F4F6',
    actionColor: '#6B7280',
  },
]

export default function ReaderHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '사용자'

  const { books, loading } = useBookshelf()
  const latestBook = books.find((b) => b.status === 'published')

  return (
    <div className="flex flex-col h-full">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <span className="text-base sm:text-xl text-[#6B7280]">{todayLabel()}</span>
        <div className="flex items-center gap-2">
          <NotificationBell role="reader" />
          <button
            type="button"
            onClick={() => navigate('/r/settings')}
            className="w-14 h-14 rounded-xl bg-[#FFF0DC] flex flex-col items-center justify-center gap-0.5"
          >
            <Settings size={20} className="text-[#E8820C]" />
            <span className="text-xs text-[#E8820C]">설정</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 sm:px-6 py-4 w-full max-w-2xl mx-auto">

        {/* 인사 카드 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
            <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
              <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
            </svg>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">{displayName} 님, 반가워요 :)</p>
            <p className="text-base text-[#6B7280]">
              {latestBook ? '엄마가 새 책을 출간했어요. 읽어보셨나요?' : '엄마가 새 책을 준비 중이에요'}
            </p>
          </div>
        </div>

        {/* 최신 출간 책 카드 */}
        {loading && (
          <div className="bg-white border-2 border-[#E5E7EB] rounded-2xl px-5 py-5 animate-pulse">
            <div className="h-5 bg-[#F3F4F6] rounded w-1/2 mb-2" />
            <div className="h-4 bg-[#F3F4F6] rounded w-2/3" />
          </div>
        )}

        {!loading && latestBook && (
          <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl overflow-visible">
            <div className="absolute -top-3 left-5 bg-[#E8820C] rounded-lg px-3 py-1">
              <span className="text-sm text-white font-medium">NEW</span>
            </div>

            <div className="flex items-stretch gap-4 px-5 pt-6 pb-5">
              {/* 책 표지 */}
              <div className="relative w-[72px] shrink-0">
                {latestBook.cover_image_url ? (
                  <img
                    src={latestBook.cover_image_url}
                    alt={latestBook.title}
                    className="w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-full bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-lg py-4 flex flex-col items-center gap-0">
                    <p className="text-xs text-[#E8820C] text-center px-1 leading-tight">
                      {latestBook.title}
                    </p>
                    <p className="text-xs text-[#6B7280] mt-1">{latestBook.month}월</p>
                  </div>
                )}
                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E8820C] opacity-35 rounded-l-lg" />
              </div>

              {/* 책 정보 */}
              <div className="flex-1 flex flex-col justify-between">
                <div className="flex flex-col gap-1">
                  <p className="text-[1.25rem] text-[#1F2937]">{latestBook.title}</p>
                  <p className="text-base text-[#6B7280]">
                    {latestBook.year}년 {latestBook.month}월
                  </p>
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
              className="w-full bg-[#E8820C] rounded-b-xl py-3 text-center"
            >
              <span className="text-[1.125rem] text-white">지금 읽기</span>
            </button>
          </div>
        )}

        {/* 최근 활동 카드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl">
          <p className="text-[1.25rem] text-[#1F2937] px-5 pt-4 pb-3">최근 활동</p>
          <div className="divide-y divide-[#E5E7EB]">
            {ACTIVITIES.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                  style={{ backgroundColor: a.iconBg }}
                >
                  <span style={{ color: a.iconColor }}>{a.icon}</span>
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.0625rem] text-[#1F2937]">{a.title}</p>
                  <p className="text-sm text-[#6B7280]">{a.meta}</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                  style={{ backgroundColor: a.actionBg }}
                >
                  <span className="text-sm" style={{ color: a.actionColor }}>{a.actionLabel}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 엄마의 책장 미리보기 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[1.25rem] text-[#1F2937]">엄마의 책장</p>
            <button type="button" onClick={() => navigate('/r/bookshelf')}>
              <span className="text-base text-[#E8820C]">모두 보기 ›</span>
            </button>
          </div>

          <ShelfRack
            books={books.slice(0, 4)}
            loading={loading}
            showInProgressPlaceholder
            rowSize={4}
          />
        </div>

        {/* 댓글 CTA */}
        {latestBook && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg">
              💬
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-[1.125rem] text-[#1F2937]">엄마에게 첫 댓글을 남겨보세요</p>
              <p className="text-sm text-[#6B7280]">{latestBook.month}월 책에 아직 댓글이 없어요</p>
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
