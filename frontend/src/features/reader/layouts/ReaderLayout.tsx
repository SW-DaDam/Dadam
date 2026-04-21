import { Outlet, NavLink } from 'react-router'

const TABS = [
  { to: '/r', label: '엄마 책장', icon: '🏠', end: true },
  { to: '/r/recent', label: '최근 읽은 책', icon: '📖', end: false },
  { to: '/r/settings', label: '설정', icon: '⚙', end: false },
]

export default function ReaderLayout() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </div>

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
      </nav>
    </div>
  )
}
