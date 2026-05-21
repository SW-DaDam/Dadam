// 오늘(KST 기준) 시작된 대화 세션 수를 Supabase에서 조회하는 훅
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// KST 기준 오늘 자정을 UTC ISO 문자열로 반환
// Supabase DB는 UTC로 저장되므로 KST 자정을 UTC로 변환해 필터링
function getTodayKstStartUtc(): string {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  kstNow.setUTCHours(0, 0, 0, 0)
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

interface UseTodayConversationCountReturn {
  todayCount: number
  loading: boolean
}

export function useTodayConversationCount(
  seniorId: string,
): UseTodayConversationCountReturn {
  const [todayCount, setTodayCount] = useState(0)
  // seniorId가 없으면 쿼리 자체를 하지 않으므로 loading 초기값도 false
  const [loading, setLoading] = useState(!!seniorId)

  useEffect(() => {
    if (!seniorId) return
    void (async () => {
      // head: true로 실제 데이터 없이 카운트만 조회해 네트워크 비용 최소화
      const { count, error } = await supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('senior_id', seniorId)
        .gte('started_at', getTodayKstStartUtc())

      if (!error && count !== null) setTodayCount(count)
      setLoading(false)
    })()
  }, [seniorId])

  return { todayCount, loading }
}
