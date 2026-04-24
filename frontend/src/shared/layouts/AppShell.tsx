import { Outlet } from 'react-router'

export default function AppShell() {
  return (
    <div className="min-h-dvh bg-[#FFF8F0] flex flex-col">
      <Outlet />
    </div>
  )
}
