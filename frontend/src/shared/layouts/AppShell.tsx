import { Outlet } from 'react-router'

export default function AppShell() {
  return (
    <div className="h-dvh overflow-hidden bg-[#D1D5DB] md:bg-[#FFF8F0] flex justify-center">
      <div className="w-full max-w-[600px] md:max-w-none md:shadow-none h-dvh bg-[#FFF8F0] flex flex-col shadow-xl overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
