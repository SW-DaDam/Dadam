import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BellRing, BookOpen, ChevronLeft, MessageCircle, Reply, Users } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { useNotificationPrefs } from '@/features/notifications/hooks/useNotificationPrefs'
import { usePushSubscription } from '@/shared/hooks/usePushSubscription'

interface NotifItem {
  id: string
  prefKey: string
  icon: ReactNode
  iconBg: string
  title: string
  desc: string
}

const NOTIF_ITEMS: NotifItem[] = [
  {
    id: 'new_book',
    prefKey: 'new_book',
    icon: <BookOpen size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '새 책 출간 알림',
    desc: '저자가 새 책을 출간하면 알려줘요',
  },
  {
    id: 'author_comment',
    prefKey: 'reader_author_comment',
    icon: <MessageCircle size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '저자의 새 댓글',
    desc: '저자가 책에 새 댓글을 남기면 알려줘요',
  },
  {
    id: 'reply',
    prefKey: 'reader_reply',
    icon: <Reply size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '내 댓글의 답글',
    desc: '저자나 다른 독자가 내 댓글에 답글을 남기면 알려줘요',
  },
  {
    id: 'other_comment',
    prefKey: 'reader_other_comment',
    icon: <Users size={20} className="text-[#9CA3AF]" />,
    iconBg: 'bg-[#F3F4F6]',
    title: '다른 독자의 새 댓글',
    desc: '다른 독자가 책에 새 댓글을 남기면 알려줘요',
  },
]

export default function ReaderNotificationSettingsPage() {
  const navigate = useNavigate()
  const { prefs, loading, updatePref, disableAll, enableAll } = useNotificationPrefs()
  const {
    supported: pushSupported,
    subscribed: pushSubscribed,
    loading: pushLoading,
    error: pushError,
    subscribe: pushSubscribe,
    unsubscribe: pushUnsubscribe,
  } = usePushSubscription()

  async function handlePushToggle(on: boolean) {
    if (on) {
      if (await pushSubscribe()) enableAll()
    } else if (await pushUnsubscribe()) {
      disableAll()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림 설정</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-5 px-4 sm:px-6 py-5 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 푸시 알림 */}
        {pushSupported && (
          <div className="w-full bg-[#E8820C] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BellRing size={20} className="text-white" />
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-xl text-white">푸시 알림</p>
              <p className="text-base text-white opacity-80">
                {pushSubscribed ? '기기 알림이 켜져 있어요' : '꺼지면 모든 알림이 오지 않아요'}
              </p>
            </div>
            <Toggle on={pushSubscribed} onChange={handlePushToggle} disabled={pushLoading} />
          </div>
        )}
        {pushError && (
          <p role="alert" className="text-sm text-red-600 px-1">{pushError}</p>
        )}

        {/* 알림 항목 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">알림 종류</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {NOTIF_ITEMS.map((item) => (
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
                  disabled={!pushSubscribed || loading}
                />
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
