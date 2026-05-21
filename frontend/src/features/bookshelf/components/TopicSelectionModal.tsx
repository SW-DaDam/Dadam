// TopicSelectionModal — 단편 책 생성 전 주제 선택 모달
// discover-short-book-topics Edge Function 호출 → 후보 주제 표시 → 선택 시 onSelect 콜백
// 첫 조회 결과는 sessionStorage에 캐싱 — 같은 탭 내 재클릭 시 즉시 표시, 페이지 종료 후 재접속 시에만 재조회

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// Edge Function이 반환하는 주제 후보 타입
export interface TopicCandidate {
  title: string
  summary: string
  date_range: string
  utterance_ids: string[]
  sample_quote: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  seniorId: string
  onSelect: (topic: TopicCandidate) => void
}

type ModalState = 'discovering' | 'selecting' | 'empty' | 'error'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// sessionStorage 캐시 키 — seniorId별로 분리
function cacheKey(seniorId: string) {
  return `short-book-topics:${seniorId}`
}

function loadCachedTopics(seniorId: string): TopicCandidate[] | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(seniorId))
    if (!raw) return null
    return JSON.parse(raw) as TopicCandidate[]
  } catch {
    return null
  }
}

function saveTopicsToCache(seniorId: string, topics: TopicCandidate[]) {
  try {
    sessionStorage.setItem(cacheKey(seniorId), JSON.stringify(topics))
  } catch {
    // sessionStorage 저장 실패(용량 초과 등)는 무시 — 다음 열기 때 재조회
  }
}

export function TopicSelectionModal({ isOpen, onClose, seniorId, onSelect }: Props) {
  const [state, setState] = useState<ModalState>('discovering')
  const [topics, setTopics] = useState<TopicCandidate[]>([])
  const [errorMessage, setErrorMessage] = useState('')

  // 모달 열릴 때 — 캐시 있으면 즉시 표시, 없으면 API 호출
  useEffect(() => {
    if (!isOpen) return

    const cached = loadCachedTopics(seniorId)
    if (cached !== null) {
      // 캐시 히트: 로딩 없이 바로 결과 표시
      setTopics(cached)
      setState(cached.length === 0 ? 'empty' : 'selecting')
      return
    }

    setState('discovering')
    setTopics([])
    setErrorMessage('')
    void discoverTopics()
  }, [isOpen, seniorId])

  async function discoverTopics() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setErrorMessage('로그인이 필요합니다')
        setState('error')
        return
      }

      const res = await fetch(`${SUPABASE_URL}/functions/v1/discover-short-book-topics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ senior_id: seniorId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }

      const body = await res.json() as { topics: TopicCandidate[] }
      const discovered = body.topics ?? []

      // 조회 성공 시 캐시 저장 (빈 배열도 저장 — 재조회는 페이지 재접속 시에만)
      saveTopicsToCache(seniorId, discovered)
      setTopics(discovered)
      setState(discovered.length === 0 ? 'empty' : 'selecting')
    } catch (err) {
      setErrorMessage(String(err))
      setState('error')
      // 에러 시에는 캐시 저장 안 함 — 다음 열기 때 다시 시도 가능
    }
  }

  if (!isOpen) return null

  return (
    // 모달 배경 오버레이
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* max-h + flex-col 으로 헤더 고정 + 본문 스크롤 */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[85dvh]">
        {/* 헤더 — 스크롤 시 상단 고정 */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-gray-900">단편 이야기 주제 선택</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 text-lg leading-none"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 — 내용이 넘칠 때 스크롤 */}
        <div className="px-6 pb-6 overflow-y-auto">
          {/* 분석 중 */}
          {state === 'discovering' && (
            <div className="flex flex-col items-center gap-4 py-10 text-gray-500">
              <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg">이야기 주제를 찾고 있어요…</p>
            </div>
          )}

          {/* 주제 후보 목록 */}
          {state === 'selecting' && (
            <div className="flex flex-col gap-3">
              <p className="text-base text-gray-500">자주 이야기하신 주제예요. 책으로 만들 이야기를 골라주세요.</p>
              <p className="text-sm text-gray-400 mb-1">단편으로 만든 이야기는 월간 회고에서 빠집니다.</p>
              {topics.map((topic) => (
                <TopicCard
                  key={topic.title}
                  topic={topic}
                  onSelect={() => {
                    // 선택 후 캐시 삭제 — 다음 열기 때 사용된 주제가 제외된 목록을 재조회
                    sessionStorage.removeItem(cacheKey(seniorId))
                    onSelect(topic)
                    onClose()
                  }}
                />
              ))}
            </div>
          )}

          {/* 후보 없음 */}
          {state === 'empty' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-gray-500">
              <span className="text-4xl">📖</span>
              <p className="text-lg">아직 단편으로 만들 이야기가 없어요.</p>
              <p className="text-base">대화를 더 나눈 뒤 다시 시도해 보세요.</p>
            </div>
          )}

          {/* 오류 */}
          {state === 'error' && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <span className="text-4xl">😔</span>
              <p className="text-lg text-gray-700">주제를 불러오지 못했어요.</p>
              <p className="text-sm text-gray-400">{errorMessage}</p>
              <button
                onClick={discoverTopics}
                className="mt-2 px-5 py-2 bg-yellow-400 text-gray-900 text-base rounded-xl hover:bg-yellow-500 active:scale-95 transition-all"
              >
                다시 시도
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 개별 주제 카드 컴포넌트
// 시니어 친화 UX: 큰 텍스트, 충분한 터치 타깃
function TopicCard({ topic, onSelect }: { topic: TopicCandidate; onSelect: () => void }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2 bg-gray-50">
      <p className="text-lg font-semibold text-gray-900">{topic.title}</p>
      {/* sample_quote: 가장 인상적인 발화 인용 */}
      <p className="text-base text-gray-600 italic">"{topic.sample_quote}"</p>
      <p className="text-sm text-gray-500">{topic.summary}</p>
      <button
        onClick={onSelect}
        className="mt-1 w-full min-h-11 px-4 py-2 bg-yellow-400 text-gray-900 text-base rounded-xl font-medium hover:bg-yellow-500 active:scale-95 transition-all"
      >
        이 주제로 책 만들기
      </button>
    </div>
  )
}
