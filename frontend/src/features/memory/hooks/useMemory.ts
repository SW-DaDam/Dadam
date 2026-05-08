// useMemory: memories 테이블에서 senior_id 기준 items 배열 조회 + 삭제 RPC 연동
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MemoryData, MemoryItem } from '@/types/domain'

interface UseMemoryReturn {
  items: MemoryItem[]
  categories: string[]         // 실제 데이터에 존재하는 카테고리 목록
  isLoading: boolean
  error: string | null
  deleteItem: (item: MemoryItem) => Promise<void>
  clearAll: () => Promise<void>
  refetch: () => void
}

/** memories 테이블 구독 + 삭제 RPC 연동 훅 */
export function useMemory(seniorId: string): UseMemoryReturn {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // tick 증가로 재조회 트리거
  const refetch = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      const { data, error: dbErr } = await supabase
        .from('memories')
        .select('data')
        .eq('senior_id', seniorId)
        .single()

      if (cancelled) return

      if (dbErr) {
        if (dbErr.code === 'PGRST116') {
          // row 없음 = 아직 대화 없음 → 빈 상태로 처리
          setItems([])
        } else {
          setError(dbErr.message)
        }
        setIsLoading(false)
        return
      }

      setItems(((data?.data as MemoryData)?.items) ?? [])
      setIsLoading(false)
    }

    void load()
    return () => { cancelled = true }
  }, [seniorId, tick])

  /** 개별 항목 삭제 — RPC remove_memory_item(p_senior_id, p_text), 낙관적 UI 적용 */
  const deleteItem = useCallback(async (item: MemoryItem) => {
    // 낙관적 UI: 즉시 화면에서 제거
    setItems((prev) => prev.filter((m) => m.text !== item.text))

    // database.ts 자동생성 타입에 신규 RPC가 미등록 — any 캐스트로 우회
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any).rpc('remove_memory_item', {
      p_senior_id: seniorId,
      p_text: item.text,
    })

    if (rpcErr) {
      console.error('[useMemory] remove_memory_item 실패', rpcErr)
      // RPC 실패 시 롤백 — 재조회
      refetch()
    }
  }, [seniorId, refetch])

  /** 전체 메모리 초기화 — RPC clear_all_memories, 낙관적 UI 적용 */
  const clearAll = useCallback(async () => {
    setItems([])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any).rpc('clear_all_memories', {
      p_senior_id: seniorId,
    })

    if (rpcErr) {
      console.error('[useMemory] clear_all_memories 실패', rpcErr)
      refetch()
    }
  }, [seniorId, refetch])

  // LLM이 추출한 실제 카테고리만 탭으로 표시 (중복 제거, 등장 순서 유지)
  const categories = [...new Set(items.map((i) => i.category))]

  return { items, categories, isLoading, error, deleteItem, clearAll, refetch }
}

/** 카테고리별 아이템 수 집계 */
export function countByCategory(items: MemoryItem[], categories: string[]): Record<string, number> {
  const counts: Record<string, number> = { '전체': items.length }
  for (const cat of categories) {
    counts[cat] = items.filter((i) => i.category === cat).length
  }
  return counts
}
