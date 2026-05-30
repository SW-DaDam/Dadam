import { useNavigate } from 'react-router'
import { Settings, ChevronRight } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { useMonthlyConversationDays } from '@/features/senior/hooks/useMonthlyConversationDays'
import { timeAgo } from '@/lib/utils'

function todayLabel() {
  return new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

export default function SeniorHomePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const displayName: string = user?.user_metadata?.full_name ?? user?.email ?? '사용자'

  // 이번 달 대화 일수 DB에서 조회
  const { days, remaining, total } = useMonthlyConversationDays(user?.id ?? '')
  // 최신 알림
  const { notifications } = useNotifications()
  const latestNotif = notifications[0] ?? null

  return (
    <div className="flex flex-col h-full">

      {/* 헤더 */}
      <header className="w-full min-h-[72px] bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-6 py-3 gap-3 shrink-0">
        <span className="flex-1 min-w-0 truncate text-lg text-[#6B7280]">{todayLabel()}</span>
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell role="senior" />
          <button
            type="button"
            onClick={() => navigate('/s/settings')}
            className="w-12 h-12 rounded-xl bg-[#FFF0DC] flex flex-col items-center justify-center gap-0.5"
          >
            <Settings size={18} className="text-[#E8820C]" />
            <span className="text-xs text-[#E8820C]">설정</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 px-4 sm:px-6 py-4 w-full max-w-2xl mx-auto">

        {/* 인사 카드 */}
        <div className="w-full bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="68" height="68" aria-hidden="true" className="shrink-0">
            <circle cx="128" cy="128" r="128" fill="#E8820C" />
            <path d="M 60 76 h 136 a 26 26 0 0 1 26 26 v 46 a 26 26 0 0 1 -26 26 h -52 l -22 22 v -22 h -62 a 26 26 0 0 1 -26 -26 v -46 a 26 26 0 0 1 26 -26 z" fill="#FFFFFF" />
            <circle cx="100" cy="125" r="9" fill="#E8820C" />
            <circle cx="128" cy="125" r="9" fill="#E8820C" />
            <circle cx="156" cy="125" r="9" fill="#E8820C" />
          </svg>
          <div className="flex-1 bg-white rounded-xl px-4 py-3 flex flex-col gap-1">
            <p className="text-[1.0625rem] text-[#1F2937]">좋은 아침이에요, {displayName} 님 :)</p>
            <p className="text-base text-[#6B7280]">오늘도 이야기 들려주세요</p>
          </div>
        </div>

        {/* AI 대화 카드 */}
        <button
          type="button"
          onClick={() => navigate('/s/chat')}
          className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-5 py-5 flex flex-col items-center gap-3 overflow-hidden"
        >
          <p className="text-[1.375rem] text-[#1F2937]">AI 말동무와 대화하기</p>

          {/* 동심원 장식 */}
          <div className="relative flex items-center justify-center w-[120px] h-[120px] shrink-0">
            <div className="absolute w-[120px] h-[120px] rounded-full bg-[#FFF8F0]" />
            <div className="absolute w-[90px] h-[90px] rounded-full bg-[#FFF0DC]" />
            <div className="absolute w-[60px] h-[60px] rounded-full bg-[#E5E7EB]" />
            {/* 마이크 아이콘 */}
            <svg width="28" height="38" viewBox="0 0 36 54" fill="none" aria-hidden="true" className="relative z-10">
              <rect x="9" y="0" width="18" height="28" rx="9" fill="#9CA3AF" />
              <path d="M2 24c0 8.837 7.163 16 16 16s16-7.163 16-16" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" fill="none" />
              <line x1="18" y1="40" x2="18" y2="52" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />
              <line x1="6" y1="52" x2="30" y2="52" stroke="#9CA3AF" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>

          <div className="w-full bg-[#F3F4F6] rounded-xl py-3 text-center">
            <p className="text-sm text-[#9CA3AF]">버튼을 누르면 대화방으로 이동해요</p>
          </div>
        </button>

        {/* 진행 카드 — 이번 달 대화 일수 DB 연동, 진행 바는 오늘 날짜 기준 */}
        <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[1.0625rem] text-[#1F2937]">이번 달 {days}일째 대화 중</p>
            <p className="text-sm text-[#6B7280]">월말까지 {remaining}일 남았어요</p>
          </div>
          <div className="w-full h-3 bg-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#E8820C] rounded-full"
              style={{ width: `${total > 0 ? ((total - remaining) / total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* 가족 활동 카드 — 알림 없으면 숨김 */}
        {latestNotif && (
          <button
            type="button"
            onClick={() => navigate('/s/notifications')}
            className="w-full bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
              <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
                <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
              </svg>
            </div>
            <div className="flex-1 flex flex-col gap-0.5 text-left min-w-0">
              <p className="text-[1.0625rem] text-[#1F2937] truncate">{latestNotif.title}</p>
              <p className="text-sm text-[#6B7280]">{timeAgo(latestNotif.created_at)}</p>
            </div>
            <ChevronRight size={20} className="text-[#D1D5DB] shrink-0" />
          </button>
        )}

      </main>
    </div>
  )
}
