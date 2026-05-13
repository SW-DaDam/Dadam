import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { useMemory, countByCategory } from '@/features/memory/hooks/useMemory'
import type { MemoryItem } from '@/types/domain'

const ALL_TAB = '전체'

export default function AiMemoryPage() {
  const navigate = useNavigate()
  const seniorId = useAuthStore((s) => s.user?.id ?? '')

  const { items, categories, isLoading, error, deleteItem, clearAll } = useMemory(seniorId)

  const [activeTab, setActiveTab] = useState<string>(ALL_TAB)
  const [deleteTarget, setDeleteTarget] = useState<MemoryItem | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)

  const allTabs = [ALL_TAB, ...categories]
  const counts = countByCategory(items, categories)

  const filtered = activeTab === ALL_TAB
    ? items
    : items.filter((m) => m.category === activeTab)

  // 전체 탭일 때는 카테고리별 그룹, 카테고리 탭일 때는 단일 그룹
  const grouped = activeTab === ALL_TAB
    ? categories.map((cat) => ({ category: cat, items: items.filter((m) => m.category === cat) }))
    : [{ category: activeTab, items: filtered }]

  async function handleDelete() {
    if (!deleteTarget) return
    await deleteItem(deleteTarget)
    setDeleteTarget(null)
  }

  async function handleClearAll() {
    await clearAll()
    setClearAllOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">
          AI가 기억하는 것들
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 안내 배너 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-bold">AI</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[1.125rem] text-[#1F2937]">대화하면서 자연스럽게 기억했어요</p>
            <p className="text-base text-[#6B7280]">마음에 들지 않는 기억은 지울 수 있어요</p>
          </div>
        </div>

        {/* 카테고리 탭 — LLM이 생성한 카테고리를 동적으로 표시 */}
        {/* rounded와 overflow-x-auto 충돌 방지: 외부 래퍼로 rounded, 내부에서 overflow 처리 */}
        {allTabs.length > 1 && (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl">
            <div className="overflow-x-auto scrollbar-none px-1.5 py-1.5">
              <div className="flex gap-1 min-w-max">
                {allTabs.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setActiveTab(label)}
                    className={cn(
                      'rounded-xl px-3 py-1.5 text-sm transition-colors whitespace-nowrap',
                      activeTab === label ? 'bg-[#E8820C] text-white' : 'text-[#6B7280]',
                    )}
                  >
                    {label} {counts[label] ?? 0}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="w-14 h-14 rounded-full border-4 border-[#E8820C] border-t-transparent animate-spin" />
          </div>
        )}

        {/* 에러 상태 */}
        {!isLoading && error && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-[1.0625rem] text-[#DC2626]">기억을 불러오지 못했어요</p>
            <p className="text-base text-[#9CA3AF]">{error}</p>
          </div>
        )}

        {/* 빈 상태 */}
        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-[1.0625rem] text-[#9CA3AF]">아직 나눈 대화가 없어요</p>
            <p className="text-base text-[#9CA3AF]">AI 말동무와 대화하면 기억이 쌓여요</p>
          </div>
        )}

        {/* 기억 목록 */}
        {!isLoading && !error && grouped.map(({ category, items: catItems }) => (
          catItems.length > 0 && (
            <div key={category} className="flex flex-col gap-1">
              <p className="text-base text-[#6B7280] px-1">{category}</p>
              <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
                {catItems.map((m) => (
                  <div key={m.text} className="flex items-center gap-3 px-5 py-4">
                    <div className="w-9 h-9 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-base">
                      {m.emoji}
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                      <p className="text-[1.125rem] text-[#1F2937]">{m.text}</p>
                      <p className="text-sm text-[#6B7280]">{m.category}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(m)}
                      className="bg-[#FEF2F2] rounded-lg px-3 py-1.5 shrink-0 min-h-11"
                    >
                      <span className="text-sm text-[#DC2626]">기억 지우기</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}

        {/* 모든 기억 지우기 */}
        {!isLoading && !error && items.length > 0 && (
          <div className="bg-white border border-[#FECACA] rounded-2xl">
            <button
              type="button"
              onClick={() => setClearAllOpen(true)}
              className="w-full py-4 text-center"
            >
              <span className="text-[1.0625rem] text-[#DC2626]">모든 기억 지우기</span>
            </button>
          </div>
        )}

      </main>

      {/* 개별 기억 지우기 다이얼로그 */}
      {deleteTarget && (
        <div className="absolute inset-0 bg-[#1F2937]/40 flex items-center justify-center z-50 px-10">
          <div className="w-full bg-white rounded-2xl px-6 py-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <span className="text-2xl text-[#DC2626] font-bold">!</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[1.375rem] text-[#1F2937] text-center">기억을 지울까요?</p>
              <p className="text-[1.0625rem] text-[#6B7280] text-center">"{deleteTarget.text}"</p>
            </div>
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-14 rounded-xl bg-[#F3F4F6] text-[1.0625rem] text-[#6B7280]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 h-14 rounded-xl bg-[#DC2626] text-[1.0625rem] text-white"
              >
                지우기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 지우기 다이얼로그 */}
      {clearAllOpen && (
        <div className="absolute inset-0 bg-[#1F2937]/40 flex items-center justify-center z-50 px-10">
          <div className="w-full bg-white rounded-2xl px-6 py-6 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
              <span className="text-2xl text-[#DC2626] font-bold">!</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[1.375rem] text-[#1F2937] text-center">모든 기억을 지울까요?</p>
              <p className="text-[1.0625rem] text-[#6B7280] text-center">AI가 기억한 모든 내용이 사라져요</p>
            </div>
            <div className="w-full flex gap-3">
              <button
                type="button"
                onClick={() => setClearAllOpen(false)}
                className="flex-1 h-14 rounded-xl bg-[#F3F4F6] text-[1.0625rem] text-[#6B7280]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 h-14 rounded-xl bg-[#DC2626] text-[1.0625rem] text-white"
              >
                모두 지우기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
