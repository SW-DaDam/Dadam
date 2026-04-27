import { Outlet, NavLink } from 'react-router'
import { MessageCircle, BookOpen, Users, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/s', label: '대화하기', icon: MessageCircle, end: true },
  { to: '/s/books', label: '내 책장', icon: BookOpen, end: false },
  { to: '/s/family', label: '가족 책장', icon: Users, end: false },
  { to: '/s/settings', label: '설정', icon: Settings, end: false },
]

export default function SeniorLayout() {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* min-h-0: flex-1 자식이 부모 높이를 초과하지 않도록 shrink 허용 */}
      <div className="flex-1 flex flex-col min-h-0">
        <Outlet />
      </div>

      {/* 탭바 */}
      <nav className="w-full bg-white border-t border-[#E5E7EB] flex shrink-0">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-3 gap-1 min-h-[72px] border-t-[3px] transition-colors',
                isActive
                  ? 'border-[#E8820C] text-[#E8820C]'
                  : 'border-transparent text-[#9CA3AF]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-xs">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
