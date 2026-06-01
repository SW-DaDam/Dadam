import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useInvite } from '@/features/family/hooks/useInvite'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// 저자 호칭 → 독자 호칭 자동 제안 매핑
const SENIOR_TITLE_MAP: Record<string, string[]> = {
  '아빠':     ['아들', '딸'],
  '아버지':   ['아들', '딸'],
  '엄마':     ['아들', '딸'],
  '어머니':   ['아들', '딸'],
  '할아버지': ['손자', '손녀'],
  '할머니':   ['손자', '손녀'],
  '장인어른': ['사위'],
  '장모님':   ['사위'],
  '시아버님': ['며느리'],
  '시어머님': ['며느리'],
}

const SENIOR_TITLE_PRESETS = Object.keys(SENIOR_TITLE_MAP)

export default function InviteAcceptPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, signInWithKakao } = useAuth()
  const { acceptInvite } = useInvite()

  const codeFromUrl = searchParams.get('code') ?? ''
  const [code, setCode] = useState(codeFromUrl.toUpperCase())
  const [seniorTitle, setSeniorTitle] = useState('')
  const [readerNickname, setReaderNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const readerSuggestions = SENIOR_TITLE_MAP[seniorTitle] ?? []

  // 저자 호칭 선택 시 독자 호칭 자동 제안
  function handleSeniorTitle(title: string) {
    setSeniorTitle(title)
    const suggestions = SENIOR_TITLE_MAP[title]
    if (suggestions?.length === 1) setReaderNickname(suggestions[0])
    else setReaderNickname('')
  }

  // 이미 연결된 사용자면 바로 독자 홈으로
  useEffect(() => {
    if (!session?.user?.id) return
    void supabase
      .from('family_links')
      .select('id')
      .eq('family_id', session.user.id)
      .eq('invite_status', 'accepted')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) navigate('/r', { replace: true }) })
  }, [session?.user?.id, navigate])

  // 비로그인 상태에서 코드 보존 후 카카오 로그인
  useEffect(() => {
    if (!session && codeFromUrl) {
      sessionStorage.setItem('pendingInviteCode', codeFromUrl)
    }
    const pending = sessionStorage.getItem('pendingInviteCode')
    if (session && pending) {
      setCode(pending.toUpperCase())
      sessionStorage.removeItem('pendingInviteCode')
    }
  }, [session, codeFromUrl])

  async function handleAccept() {
    if (!session) { await signInWithKakao(); return }
    if (!code || !seniorTitle || !readerNickname) return
    setLoading(true)
    const res = await acceptInvite(code, seniorTitle, readerNickname)
    setResult(res)
    setLoading(false)
    if (res.ok) setTimeout(() => navigate('/r'), 2000)
  }

  return (
    <div className="min-h-dvh bg-[#FFF8F0] overflow-y-auto">
      <div className="w-full max-w-md mx-auto flex flex-col gap-6 px-4 py-10">

        {/* 헤더 */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[#E8820C] flex items-center justify-center">
            <span className="text-2xl text-white font-bold">AI</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937] text-center">가족으로 연결하기</h1>
          <p className="text-lg text-[#6B7280] text-center">호칭을 정하고 연결해요</p>
        </div>

        {/* 결과 메시지 */}
        {result && (
          <div className={cn(
            'rounded-2xl px-5 py-4 text-center text-lg font-medium',
            result.ok ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]',
          )}>
            {result.message}
          </div>
        )}

        {!result?.ok && (
          <>
            {/* 초대 코드 */}
            <div className="flex flex-col gap-2">
              <label className="text-base text-[#6B7280] px-1">초대 코드</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="예: A3K7F2"
                maxLength={8}
                className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 text-2xl text-center text-[#1F2937] tracking-widest font-mono outline-none focus:border-[#E8820C]"
              />
            </div>

            {/* 내가 저자를 부르는 호칭 */}
            <div className="flex flex-col gap-2">
              <label className="text-base text-[#6B7280] px-1">저자를 어떻게 부르나요?</label>
              <div className="flex flex-wrap gap-2">
                {SENIOR_TITLE_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleSeniorTitle(t)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-base min-h-11 transition-colors',
                      seniorTitle === t
                        ? 'bg-[#E8820C] text-white'
                        : 'bg-white border border-[#E5E7EB] text-[#6B7280]',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {seniorTitle === '' && (
                <input
                  type="text"
                  placeholder="직접 입력"
                  onChange={(e) => handleSeniorTitle(e.target.value)}
                  className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-3 text-lg text-[#1F2937] outline-none focus:border-[#E8820C]"
                />
              )}
            </div>

            {/* 저자가 나를 부르는 호칭 */}
            {seniorTitle !== '' && (
              <div className="flex flex-col gap-2">
                <label className="text-base text-[#6B7280] px-1">저자가 나를 어떻게 부르나요?</label>
                <div className="flex flex-wrap gap-2">
                  {readerSuggestions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setReaderNickname(n)}
                      className={cn(
                        'px-4 py-2.5 rounded-xl text-base min-h-11 transition-colors',
                        readerNickname === n
                          ? 'bg-[#E8820C] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#6B7280]',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReaderNickname('')}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-base min-h-11 transition-colors',
                      readerNickname === '' || !readerSuggestions.includes(readerNickname)
                        ? 'bg-[#E8820C] text-white'
                        : 'bg-white border border-[#E5E7EB] text-[#6B7280]',
                    )}
                  >
                    직접 입력
                  </button>
                </div>
                {(!readerSuggestions.includes(readerNickname) || readerNickname === '') && (
                  <input
                    type="text"
                    value={readerNickname}
                    onChange={(e) => setReaderNickname(e.target.value)}
                    placeholder="예: 아들, 딸, 손자..."
                    className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-3 text-lg text-[#1F2937] outline-none focus:border-[#E8820C]"
                  />
                )}
                {seniorTitle && readerNickname && (
                  <div className="bg-[#FFF0DC] rounded-xl px-4 py-3">
                    <p className="text-base text-[#E8820C]">
                      ✓ {seniorTitle}가 나를 "{readerNickname}"(으)로, 나는 "{seniorTitle}"(으)로 부를게요
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 확인 버튼 */}
            <button
              type="button"
              onClick={handleAccept}
              disabled={loading || !code || !seniorTitle || !readerNickname}
              className="w-full bg-[#E8820C] disabled:bg-[#E5E7EB] rounded-2xl py-4 text-xl text-white font-medium min-h-14 transition-colors"
            >
              {loading ? '연결 중…' : session ? '가족으로 연결하기' : '카카오로 로그인 후 연결하기'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
