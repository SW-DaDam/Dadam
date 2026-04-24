import { useNavigate } from 'react-router'
import { Bell, Settings } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}

const UNREAD_COUNT = 2

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

const SHELF_BOOKS = [
  { month: '4월', bg: '#FFF0DC', border: '#E8820C', accent: '#E8820C', textColor: '#E8820C', badge: 'NEW', badgeBg: '#E8820C' },
  { month: '3월', bg: '#DCFCE7', border: '#16A34A', accent: '#16A34A', textColor: '#16A34A', badge: '7', badgeBg: '#16A34A' },
  { month: '2월', bg: '#FEF9C3', border: '#CA8A04', accent: '#CA8A04', textColor: '#CA8A04', badge: null, badgeBg: '' },
  { month: '1월', bg: '#F3F4F6', border: '#E5E7EB', accent: '#9CA3AF', textColor: '#6B7280', badge: null, badgeBg: '' },
]

export default function ReaderHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '사용자'

  return (
    <div className="flex flex-col min-h-full">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 shrink-0">
        <span className="text-base sm:text-xl text-[#6B7280]">{todayLabel()}</span>
        <div className="flex items-center gap-2">
          {/* 알림 버튼 */}
          <button
            type="button"
            onClick={() => navigate('/r/notifications')}
            className="relative w-14 h-14 rounded-xl bg-[#FFF0DC] flex flex-col items-center justify-center gap-0.5"
          >
            <Bell size={20} className="text-[#E8820C]" />
            <span className="text-xs text-[#E8820C]">알림</span>
            {UNREAD_COUNT > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#DC2626] flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">{UNREAD_COUNT}</span>
              </span>
            )}
          </button>
          {/* 설정 버튼 */}
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

      <main className="flex-1 overflow-y-auto flex flex-col gap-3 px-4 sm:px-6 py-4 w-full max-w-2xl mx-auto">

        {/* 인사 카드 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
            <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
              <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
            </svg>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3 flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">{displayName} 님, 반가워요 :)</p>
            <p className="text-base text-[#6B7280]">엄마가 새 책을 출간했어요. 읽어보셨나요?</p>
          </div>
        </div>

        {/* 새 책 카드 */}
        <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl overflow-visible">
          {/* NEW 뱃지 */}
          <div className="absolute -top-3 left-5 bg-[#E8820C] rounded-lg px-3 py-1">
            <span className="text-sm text-white font-medium">NEW</span>
          </div>

          <div className="flex items-stretch gap-4 px-5 pt-6 pb-5">
            {/* 책 표지 */}
            <div className="relative w-[72px] shrink-0">
              <div className="w-full bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-lg py-4 flex flex-col items-center gap-0">
                <p className="text-sm text-[#E8820C]">봄날의</p>
                <p className="text-sm text-[#E8820C]">기록</p>
                <p className="text-xs text-[#6B7280] mt-1">4월</p>
              </div>
              <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E8820C] opacity-35 rounded-l-lg" />
            </div>

            {/* 책 정보 */}
            <div className="flex-1 flex flex-col justify-between">
              <div className="flex flex-col gap-1">
                <p className="text-[1.25rem] text-[#1F2937]">봄날의 기록</p>
                <p className="text-base text-[#6B7280]">김영숙 지음 · 2025년 4월</p>
                <p className="text-base text-[#6B7280]">챕터 3개 · 에필로그 포함</p>
              </div>
            </div>
          </div>

          {/* 지금 읽기 버튼 */}
          <button
            type="button"
            onClick={() => navigate('/r/books/april')}
            className="w-full bg-[#E8820C] rounded-b-xl py-3 text-center"
          >
            <span className="text-[1.125rem] text-white">지금 읽기</span>
          </button>
        </div>

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
            <button type="button">
              <span className="text-base text-[#E8820C]">모두 보기 ›</span>
            </button>
          </div>

          {/* 책 진열 */}
          <div className="bg-[#F5E6D0] rounded-xl px-3 py-3 flex gap-2">
            {SHELF_BOOKS.map((book) => (
              <button
                key={book.month}
                type="button"
                className="flex-1 flex flex-col items-center gap-1 relative"
                onClick={() => navigate(`/r/books/${book.month}`)}
              >
                <div
                  className="relative w-full rounded-lg py-5 flex items-center justify-center"
                  style={{ backgroundColor: book.bg, border: `1.5px solid ${book.border}` }}
                >
                  {/* 왼쪽 accent */}
                  <div
                    className="absolute top-0 bottom-0 left-0 w-1.5 rounded-l-lg"
                    style={{ backgroundColor: book.accent, opacity: 0.35 }}
                  />
                  {/* 뱃지 */}
                  {book.badge && (
                    <span
                      className="absolute top-1 right-1 rounded px-1 text-[9px] text-white font-bold leading-tight"
                      style={{ backgroundColor: book.badgeBg }}
                    >
                      {book.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: book.textColor }}>{book.month}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 댓글 CTA */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FFF0DC] flex items-center justify-center shrink-0 text-lg">
            💬
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.125rem] text-[#1F2937]">엄마에게 첫 댓글을 남겨보세요</p>
            <p className="text-sm text-[#6B7280]">4월 책에 아직 댓글이 없어요</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/r/books/april')}
            className="bg-[#E8820C] rounded-xl px-3 py-2 shrink-0 min-h-11"
          >
            <span className="text-sm text-white">댓글 달러가기</span>
          </button>
        </div>

      </main>
    </div>
  )
}
