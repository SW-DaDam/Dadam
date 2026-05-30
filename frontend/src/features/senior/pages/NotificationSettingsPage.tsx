import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Bell, BookMarked, BookOpen, ChevronLeft, Info, MessageCircle, Moon, Reply } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { useNotificationPrefs } from '@/features/notifications/hooks/useNotificationPrefs'

interface NotifItem {
  id: string
  prefKey: string
  icon: ReactNode
  iconBg: string
  title: string
  desc: string
}

const FAMILY_NOTIFS: NotifItem[] = [
  {
    id: 'comment',
    prefKey: 'new_comment',
    icon: <MessageCircle size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '가족이 댓글을 달았을 때',
    desc: '자녀·손주가 내 책에 댓글을 남기면',
  },
  {
    id: 'reply',
    prefKey: 'new_reply',
    icon: <Reply size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '내 댓글에 답장이 왔을 때',
    desc: '저자가 내 댓글에 음성 답장을 남기면',
  },
]

const BOOK_NOTIFS: NotifItem[] = [
  {
    id: 'draft',
    prefKey: 'book_draft',
    icon: <BookOpen size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '이번 달 책 초안이 완성됐을 때',
    desc: '월말에 AI가 책 초안을 만들어 두면',
  },
  {
    id: 'publish',
    prefKey: 'book_publish',
    icon: <BookMarked size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '책이 가족 책장에 출간됐을 때',
    desc: '편집을 마친 책이 가족에게 공개되면',
  },
  {
    id: 'remind',
    prefKey: 'daily_remind',
    icon: <Bell size={20} className="text-[#6B7280]" />,
    iconBg: 'bg-[#F3F4F6]',
    title: '오늘 아직 대화를 안 했을 때',
    desc: '하루에 한 번, 오전에 부드럽게 알려줘요',
  },
]

export default function NotificationSettingsPage() {
  const navigate = useNavigate()
  const { prefs, loading, updatePref } = useNotificationPrefs()

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림 설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 가족 활동 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">가족 활동</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {FAMILY_NOTIFS.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-4">
                <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                  {item.icon}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.0625rem] text-[#1F2937]">{item.title}</p>
                  <p className="text-sm text-[#6B7280]">{item.desc}</p>
                </div>
                <Toggle
                  on={!loading && prefs[item.prefKey as keyof typeof prefs]}
                  onChange={(v) => updatePref(item.prefKey as keyof typeof prefs, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 책 만들기 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">책 만들기</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {BOOK_NOTIFS.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-4">
                <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                  {item.icon}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                  <p className="text-[1.0625rem] text-[#1F2937]">{item.title}</p>
                  <p className="text-sm text-[#6B7280]">{item.desc}</p>
                </div>
                <Toggle
                  on={!loading && prefs[item.prefKey as keyof typeof prefs]}
                  onChange={(v) => updatePref(item.prefKey as keyof typeof prefs, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 알림 받지 않을 시간 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">알림 받지 않을 시간</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
              <Moon size={20} className="text-[#6B7280]" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <p className="text-[1.0625rem] text-[#1F2937]">밤 10시 ~ 아침 7시</p>
              <p className="text-sm text-[#6B7280]">이 시간에는 알림이 오지 않아요</p>
            </div>
            <button type="button" className="bg-[#FFF0DC] rounded-lg px-3 py-2 text-base text-[#E8820C] shrink-0 min-h-11">
              시간 바꾸기
            </button>
          </div>
        </div>

        {/* 카카오 안내 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <Info size={18} className="text-[#6B7280]" />
          </div>
          <div className="flex flex-col gap-1 pt-1">
            <p className="text-sm text-[#6B7280]">알림은 카카오톡 메시지로도 함께 와요</p>
            <p className="text-sm text-[#6B7280]">카카오 알림 설정은 카카오 앱에서 바꿀 수 있어요</p>
          </div>
        </div>

      </main>
    </div>
  )
}
