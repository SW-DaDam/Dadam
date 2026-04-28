import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type Category = '전체' | '취미' | '가족' | '추억' | '일상'

interface Memory {
  id: number
  emoji: string
  text: string
  source: string
  category: Exclude<Category, '전체'>
}

const INITIAL_MEMORIES: Memory[] = [
  { id: 1, emoji: '🌱', text: '텃밭 가꾸기를 좋아해요', source: '4월 3일 대화에서 · "토마토 수확했어요"', category: '취미' },
  { id: 2, emoji: '🌧', text: '비 오는 날 창가에 앉는 걸 좋아해요', source: '4월 9일 대화에서 · "봄비가 왔어요"', category: '취미' },
  { id: 3, emoji: '📺', text: '저녁에 드라마 보는 걸 즐겨요', source: '3월 22일 대화에서 · "드라마가 재밌어요"', category: '취미' },
  { id: 4, emoji: '☕', text: '아침에 따뜻한 차 한 잔 마셔요', source: '3월 15일 대화에서 · "아침 루틴이에요"', category: '취미' },
  { id: 5, emoji: '👧', text: '손녀 수빈이가 올해 중학생이 됐어요', source: '4월 5일 대화에서 · "교복이 잘 어울려요"', category: '가족' },
  { id: 6, emoji: '👨', text: '아들 민준이는 서울에 살아요', source: '3월 28일 대화에서 · "주말에 왔어요"', category: '가족' },
  { id: 7, emoji: '🏠', text: '경기도 수원에 살고 있어요', source: '3월 10일 대화에서 · "동네 얘기를 했어요"', category: '가족' },
  { id: 8, emoji: '🌸', text: '젊을 때 벚꽃 구경 다니는 걸 좋아했어요', source: '4월 11일 대화에서 · "봄 얘기를 했어요"', category: '추억' },
  { id: 9, emoji: '🍚', text: '된장찌개를 제일 잘 끓인다고 하셨어요', source: '3월 19일 대화에서 · "요리 얘기를 했어요"', category: '추억' },
]

const CATEGORIES: { label: Category; count: number }[] = [
  { label: '전체', count: 24 },
  { label: '취미', count: 8 },
  { label: '가족', count: 6 },
  { label: '추억', count: 5 },
  { label: '일상', count: 5 },
]

export default function AiMemoryPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Category>('전체')
  const [memories, setMemories] = useState(INITIAL_MEMORIES)
  const [deleteTarget, setDeleteTarget] = useState<Memory | null>(null)
  const [clearAll, setClearAll] = useState(false)

  const filtered = activeTab === '전체' ? memories : memories.filter((m) => m.category === activeTab)

  const grouped = (['취미', '가족', '추억', '일상'] as const).map((cat) => ({
    category: cat,
    items: filtered.filter((m) => m.category === cat),
  })).filter((g) => g.items.length > 0)

  function handleDelete() {
    if (deleteTarget) {
      setMemories((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  function handleClearAll() {
    setMemories([])
    setClearAll(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">AI가 기억하는 것들</h1>
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

        {/* 카테고리 탭 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-2 py-2 flex gap-1 overflow-x-auto">
          {CATEGORIES.map(({ label, count }) => (
            <button
              key={label}
              type="button"
              onClick={() => setActiveTab(label)}
              className={cn(
                'flex-shrink-0 rounded-xl px-3 py-1.5 text-base transition-colors',
                activeTab === label
                  ? 'bg-[#E8820C] text-white'
                  : 'text-[#6B7280]',
              )}
            >
              {label} {count}
            </button>
          ))}
        </div>

        {/* 기억 목록 */}
        {grouped.map(({ category, items }) => (
          <div key={category} className="flex flex-col gap-1">
            <p className="text-base text-[#6B7280] px-1">{category}</p>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
              {items.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF0DC] flex items-center justify-center shrink-0 text-base">
                    {m.emoji}
                  </div>
                  <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                    <p className="text-[1.125rem] text-[#1F2937]">{m.text}</p>
                    <p className="text-sm text-[#6B7280]">{m.source}</p>
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
        ))}

        {/* 모든 기억 지우기 */}
        {memories.length > 0 && (
          <div className="bg-white border border-[#FECACA] rounded-2xl">
            <button
              type="button"
              onClick={() => setClearAll(true)}
              className="w-full py-4 text-center"
            >
              <span className="text-[1.0625rem] text-[#DC2626]">모든 기억 지우기</span>
            </button>
          </div>
        )}

        {memories.length === 0 && (
          <div className="flex flex-col items-center py-16 gap-3">
            <p className="text-[1.0625rem] text-[#9CA3AF]">저장된 기억이 없어요</p>
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
      {clearAll && (
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
                onClick={() => setClearAll(false)}
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
