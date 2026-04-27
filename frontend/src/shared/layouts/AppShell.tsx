import { Outlet } from 'react-router'

// 웹 데스크톱에서도 모바일 UI로 표시 — 중앙에 폰 너비로 제한
export default function AppShell() {
  return (
    <div className="min-h-dvh bg-[#D1D5DB] flex justify-center">
      <div className="w-full max-w-[600px] h-dvh bg-[#FFF8F0] flex flex-col shadow-xl overflow-hidden">
        <Outlet />
      </div>
    </div>
  )
}
