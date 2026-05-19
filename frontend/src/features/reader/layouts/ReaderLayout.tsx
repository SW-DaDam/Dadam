import { Outlet, NavLink } from 'react-router'
import { Home, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'

function UnreadDot() {
  const { notifications } = useNotifications()
  const hasUnread = notifications.some((n) => !n.is_read)
  if (!hasUnread) return null
  return <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#E8820C]" />
}

const TABS = [
  { to: '/r', label: '책장', icon: Home, end: true },
  { to: '/r/notifications', label: '알림', icon: Bell, end: false },
  { to: '/r/settings', label: '설정', icon: Settings, end: false },
]

export default function ReaderLayout() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>

      <nav className="w-full bg-white dark:bg-gray-800 border-t border-[#E5E7EB] dark:border-gray-700 flex shrink-0">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 relative flex flex-col items-center justify-center py-3 gap-1 min-h-[72px] border-t-[3px] transition-colors',
                isActive ? 'border-[#E8820C] text-[#E8820C]' : 'border-transparent text-[#9CA3AF]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs">{label}</span>
                {to === '/r/notifications' && <UnreadDot />}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
