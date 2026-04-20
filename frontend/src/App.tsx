// MVP 진입점 — 현재는 Tailwind/Supabase 연결 확인용 스타터 화면
// 실제 라우팅·페이지는 이후 PR에서 src/routes/ 에 구현한다
function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 text-neutral-900">
      <h1 className="text-4xl font-semibold">다담 (Dadam)</h1>
      <p className="text-neutral-600">시니어 가족 출판 플랫폼 — 초기 세팅 완료</p>
    </main>
  )
}

export default App
