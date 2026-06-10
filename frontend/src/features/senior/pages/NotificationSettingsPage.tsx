import { type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { BellRing, BookOpen, ChevronLeft, MessageCircle, MessagesSquare, Reply } from 'lucide-react'
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

const BOOK_NOTIFS: NotifItem[] = [
  {
    id: 'draft',
    prefKey: 'book_draft',
    icon: <BookOpen size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '이번 달 책 초안이 완성됐을 때',
    desc: '월말에 AI가 책 초안을 만들어 두면',
  },
]

const COMMENT_NOTIFS: NotifItem[] = [
  {
    id: 'new-comment',
    prefKey: 'author_new_comment',
    icon: <MessageCircle size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '내 책의 새 댓글',
    desc: '독자가 내 책에 새 댓글을 남기면',
  },
  {
    id: 'reply',
    prefKey: 'author_reply',
    icon: <Reply size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '내 댓글의 답글',
    desc: '독자가 내가 쓴 댓글에 답글을 남기면',
  },
  {
    id: 'family-comment',
    prefKey: 'author_family_comment',
    icon: <MessagesSquare size={20} className="text-[#E8820C]" />,
    iconBg: 'bg-[#FFF0DC]',
    title: '가족끼리 주고받는 댓글',
    desc: '독자들이 서로 댓글과 답글을 주고받으면',
  },
]

export default function NotificationSettingsPage() {
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
                  disabled={!pushSubscribed || loading}
                />
              </div>
            ))}
          </div>
        </div>

        {/* 댓글 알림 섹션 */}
        <div className="flex flex-col gap-1">
          <p className="text-base text-[#6B7280] px-1">댓글 알림</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {COMMENT_NOTIFS.map((item) => (
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
