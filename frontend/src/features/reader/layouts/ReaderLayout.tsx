import { useState } from 'react'
import { Outlet, NavLink } from 'react-router'
import { useNotifications } from '@/features/notifications/hooks/useNotifications'
import { NotificationDropdown } from '@/features/notifications/components/NotificationDropdown'

const TABS = [
  { to: '/r', label: '엄마 책장', icon: '🏠', end: true },
  { to: '/r/recent', label: '최근 읽은 책', icon: '📖', end: false },
  { to: '/r/settings', label: '설정', icon: '⚙', end: false },
]

function NotificationTabButton({ onClick }: { onClick: () => void }) {
  const { unreadCount } = useNotifications()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[#6B7280]"
    >
      <span className="relative inline-flex items-center justify-center">
        <span className="text-2xl leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 rounded-full flex items-center justify-center px-0.5">
            <span className="text-[9px] text-white font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          </span>
        )}
      </span>
      <span className="text-[0.9375rem]">알림</span>
    </button>
  )
}

export default function ReaderLayout() {
  const [showDropdown, setShowDropdown] = useState(false)

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>

      {showDropdown && <NotificationDropdown onClose={() => setShowDropdown(false)} />}

      {/* 탭 바 */}
      <nav className="w-full bg-white border-t border-[#E5E7EB] flex shrink-0">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative ${
                isActive ? 'text-[#E8820C]' : 'text-[#6B7280]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-0 right-0 h-[3px] bg-[#E8820C] rounded-b" />
                )}
                <span className="text-2xl leading-none">{tab.icon}</span>
                <span className="text-[0.9375rem]">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
        <NotificationTabButton onClick={() => setShowDropdown((v) => !v)} />
      </nav>
    </div>
  )
}
