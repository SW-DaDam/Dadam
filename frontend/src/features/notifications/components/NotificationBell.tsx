import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useNotifications } from '../hooks/useNotifications'

interface NotificationBellProps {
  role: 'senior' | 'reader'
}

export function NotificationBell({ role }: NotificationBellProps) {
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const href = role === 'senior' ? '/s/notifications' : '/r/notifications'

  return (
    <button
      type="button"
      onClick={() => navigate(href)}
      className="relative w-14 h-14 rounded-xl bg-[#FFF0DC] flex flex-col items-center justify-center gap-0.5 min-h-11"
      aria-label={`알림${unreadCount > 0 ? ` ${unreadCount}개 미읽음` : ''}`}
    >
      <Bell size={20} className="text-[#E8820C]" />
      <span className="text-xs text-[#E8820C]">알림</span>
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full flex items-center justify-center px-1">
          <span className="text-[10px] text-white font-bold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        </span>
      )}
    </button>
  )
}
