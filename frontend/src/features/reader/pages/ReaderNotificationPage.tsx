import { useNavigate } from 'react-router'
import { ChevronLeft, Play, X } from 'lucide-react'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import type { Notification, NotificationType } from '@/types/domain'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function Avatar({ type }: { type: NotificationType }) {
  if (type === 'new_reply') {
    return (
      <div className="w-10 h-10 rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
        <svg width="18" height="16" viewBox="0 0 40 36" fill="#3C1E1E8C" aria-hidden="true">
          <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
        </svg>
      </div>
    )
  }
  if (type === 'new_book' || type === 'book_draft_ready') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#E8820C] flex items-center justify-center shrink-0">
        <span className="text-xl">📖</span>
      </div>
    )
  }
  if (type === 'invite_accepted') {
    return (
      <div className="w-10 h-10 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0">
        <span className="text-xl">♥</span>
      </div>
    )
  }
  return (
    <div className="w-10 h-10 rounded-xl bg-[#F3F4F6] flex items-center justify-center shrink-0">
      <span className="text-xl">💬</span>
    </div>
  )
}

function actionLabelFor(type: NotificationType): string {
  if (type === 'new_reply') return '답장 듣기'
  if (type === 'new_book') return '지금 읽기'
  if (type === 'new_comment') return '보러가기'
  if (type === 'invite_accepted') return '가족 보기'
  return '확인하기'
}

function getNavPath(noti: Notification): string {
  if (noti.type === 'new_book' && noti.reference_id) return `/r/books/${noti.reference_id}`
  if (noti.type === 'new_reply' && noti.reference_id) return `/r/books/${noti.reference_id}`
  if (noti.type === 'invite_accepted') return '/r/settings'
  return '/r'
}

export default function ReaderNotificationPage() {
  const navigate = useNavigate()
  const { notifications, loading, markAsRead, markAllRead, deleteNotification } = useNotifications()

  const unread = notifications.filter((n) => !n.is_read)
  const read = notifications.filter((n) => n.is_read)

  async function handleAction(noti: Notification) {
    if (!noti.is_read) await markAsRead(noti.id)
    navigate(getNavPath(noti))
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">알림</h1>
        <button
          type="button"
          onClick={markAllRead}
          className="ml-auto bg-[#FFF0DC] rounded-lg px-3 py-1.5 min-h-11"
        >
          <span className="text-sm text-[#E8820C]">모두 읽음 처리</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-yellow-400 border-t-transparent" />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <p className="text-center text-base text-[#9CA3AF] py-10">알림이 없어요</p>
        )}

        {/* 안 읽은 알림 */}
        {unread.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-base text-[#6B7280] px-1">안 읽은 알림 {unread.length}개</p>
            <div className="flex flex-col gap-2">
              {unread.map((n) => (
                <div
                  key={n.id}
                  className="relative bg-[#FFF0DC] border-[1.5px] border-[#E8820C] rounded-2xl overflow-hidden"
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#E8820C]" />
                  <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#E8820C]" />
                  <div className="pl-4 pr-5 py-4 flex items-start gap-3">
                    <Avatar type={n.type} />
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0 pr-4">
                      <p className="text-[1.125rem] text-[#1F2937]">{n.title}</p>
                      {n.body && <p className="text-base text-[#1F2937]">{n.body}</p>}
                      <p className="text-sm text-[#6B7280]">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                  <div className="px-5 pb-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAction(n)}
                      className="bg-[#E8820C] rounded-xl px-4 py-2 flex items-center gap-1.5 min-h-11"
                    >
                      {n.type === 'new_reply' && <Play size={13} className="text-white fill-white" />}
                      <span className="text-sm text-white">{actionLabelFor(n.type)}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 읽은 알림 */}
        {read.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-base text-[#6B7280] px-1">읽은 알림</p>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
              {read.map((n) => (
                <div key={n.id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar type={n.type} />
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <p className="text-[1.0625rem] text-[#6B7280]">{n.title}</p>
                    <p className="text-sm text-[#9CA3AF]">{timeAgo(n.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAction(n)}
                    className="bg-[#F3F4F6] rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                  >
                    <span className="text-sm text-[#9CA3AF]">{actionLabelFor(n.type)} ›</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteNotification(n.id)}
                    className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0"
                  >
                    <X size={15} className="text-[#9CA3AF]" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
