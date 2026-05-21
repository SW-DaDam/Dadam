import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { X } from 'lucide-react'
import { useNotifications } from '../hooks/useNotifications'
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

function emojiFor(type: NotificationType): string {
  if (type === 'new_reply') return '💬'
  if (type === 'new_book') return '📖'
  if (type === 'invite_accepted') return '♥'
  if (type === 'new_comment') return '💬'
  return '✦'
}

function navPathFor(noti: Notification): string {
  if (noti.type === 'new_book' && noti.reference_id) return `/r/books/${noti.reference_id}`
  if (noti.type === 'new_reply' && noti.reference_id) return `/r/books/${noti.reference_id}`
  return '/r'
}

interface NotificationDropdownProps {
  onClose: () => void
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const navigate = useNavigate()
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications()
  const ref = useRef<HTMLDivElement>(null)
  const recent = notifications.slice(0, 5)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  async function handleItem(noti: Notification) {
    if (!noti.is_read) await markAsRead(noti.id)
    onClose()
    navigate(navPathFor(noti))
  }

  async function handleMarkAll() {
    await markAllRead()
  }

  return (
    <div
      ref={ref}
      className="fixed bottom-[72px] left-0 right-0 mx-auto w-full max-w-lg bg-white border border-[#E5E7EB] rounded-t-2xl shadow-xl z-50 flex flex-col max-h-[60vh]"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium text-[#1F2937]">알림</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAll} className="text-sm text-[#E8820C]">
              모두 읽음
            </button>
          )}
          <button type="button" onClick={onClose} className="min-h-11 flex items-center">
            <X size={20} className="text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      {/* 목록 */}
      <div className="flex flex-col divide-y divide-[#F3F4F6] overflow-y-auto max-h-[50vh]">
        {recent.length === 0 && (
          <p className="text-center text-base text-[#9CA3AF] py-8">알림이 없어요</p>
        )}
        {recent.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => handleItem(n)}
            className="flex items-center gap-3 px-5 py-4 text-left w-full min-h-[60px]"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.is_read ? 'bg-[#F3F4F6]' : 'bg-[#FFF0DC]'}`}>
              <span className="text-base">{emojiFor(n.type)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-base truncate ${n.is_read ? 'text-[#6B7280]' : 'text-[#1F2937] font-medium'}`}>
                {n.title}
              </p>
              <p className="text-sm text-[#9CA3AF]">{timeAgo(n.created_at)}</p>
            </div>
            {!n.is_read && (
              <span className="w-2 h-2 rounded-full bg-[#E8820C] shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* 모두 보기 */}
      <button
        type="button"
        onClick={() => { onClose(); navigate('/r/notifications') }}
        className="w-full py-4 text-base text-[#E8820C] text-center border-t border-[#E5E7EB] min-h-11"
      >
        알림 모두 보기 →
      </button>
    </div>
  )
}
