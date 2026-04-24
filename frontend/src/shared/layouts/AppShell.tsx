import { Outlet } from 'react-router'

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] dark:bg-gray-900 dark:text-gray-100 flex flex-col">
      <Outlet />
    </div>
  )
}
