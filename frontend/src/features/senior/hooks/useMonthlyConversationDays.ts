// 이번 달(KST 기준) 대화한 고유 일수를 Supabase에서 조회하는 훅
// conversations.started_at을 KST로 변환 후 날짜 중복 제거하여 일수 계산
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// KST 기준 이번 달 1일 00:00:00 UTC ISO 문자열 반환
function getMonthStartUtc(): string {
  const now = new Date()
  // KST = UTC+9이므로 오프셋 적용
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const kstMonthStart = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1))
  // 다시 UTC로 변환
  return new Date(kstMonthStart.getTime() - 9 * 60 * 60 * 1000).toISOString()
}

// KST 기준 이번 달 마지막일 반환
function getMonthLastDay(): number {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  // 다음 달 0일 = 이번 달 마지막일
  return new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 0)).getUTCDate()
}

// KST 기준 오늘 일(day) 반환
function getTodayKstDay(): number {
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kstNow.getUTCDate()
}

interface UseMonthlyConversationDaysReturn {
  days: number       // 이번 달 대화한 고유 일수
  remaining: number  // 월말까지 남은 일수
  total: number      // 이번 달 총 일수
  loading: boolean
}

export function useMonthlyConversationDays(
  seniorId: string,
): UseMonthlyConversationDaysReturn {
  const total = getMonthLastDay()
  const todayDay = getTodayKstDay()

  const [days, setDays] = useState(0)
  const [loading, setLoading] = useState(!!seniorId)

  useEffect(() => {
    if (!seniorId) return
    void (async () => {
      // 이번 달 모든 대화의 started_at을 가져와 JS에서 날짜 중복 제거
      // head:false로 실제 데이터 조회 (날짜 추출을 위해 필요)
      const { data, error } = await supabase
        .from('conversations')
        .select('started_at')
        .eq('senior_id', seniorId)
        .gte('started_at', getMonthStartUtc())

      if (!error && data) {
        // KST 기준 날짜 문자열(YYYY-MM-DD)로 변환 후 Set으로 중복 제거
        const uniqueDays = new Set(
          data.map((row) => {
            const kst = new Date(new Date(row.started_at).getTime() + 9 * 60 * 60 * 1000)
            return `${kst.getUTCFullYear()}-${kst.getUTCMonth()}-${kst.getUTCDate()}`
          })
        )
        setDays(uniqueDays.size)
      }
      setLoading(false)
    })()
  }, [seniorId])

  // remaining: 오늘 포함 월말까지 남은 일수 (total - 오늘 일)
  const remaining = Math.max(0, total - todayDay)

  return { days, remaining, total, loading }
}
