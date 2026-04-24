import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useInvite } from '@/features/family/hooks/useInvite'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { cn } from '@/lib/utils'

const RELATION_PRESETS = ['아들', '딸', '손자', '손녀', '사위', '며느리']

export default function InviteAcceptPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { session, signInWithKakao } = useAuth()
  const { acceptInvite } = useInvite()

  const codeFromUrl = searchParams.get('code') ?? ''
  const [code, setCode] = useState(codeFromUrl.toUpperCase())
  const [relation, setRelation] = useState('')
  const [customRelation, setCustomRelation] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const finalRelation = relation === '직접입력' ? customRelation : relation

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
    if (!code || !finalRelation) return
    setLoading(true)
    const res = await acceptInvite(code, finalRelation)
    setResult(res)
    setLoading(false)
    if (res.ok) setTimeout(() => navigate('/r'), 2000)
  }

  return (
    <div className="min-h-dvh bg-[#FFF8F0] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col gap-6">

        {/* 헤더 */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-[#E8820C] flex items-center justify-center">
            <span className="text-2xl text-white font-bold">AI</span>
          </div>
          <h1 className="text-2xl font-bold text-[#1F2937] text-center">가족으로 연결하기</h1>
          <p className="text-lg text-[#6B7280] text-center">초대 코드를 입력하고 연결해요</p>
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
            {/* 초대 코드 입력 */}
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

            {/* 관계 선택 */}
            <div className="flex flex-col gap-2">
              <label className="text-base text-[#6B7280] px-1">나는 어떤 관계인가요?</label>
              <div className="flex flex-wrap gap-2">
                {[...RELATION_PRESETS, '직접입력'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRelation(r)}
                    className={cn(
                      'px-4 py-2.5 rounded-xl text-base min-h-11 transition-colors',
                      relation === r
                        ? 'bg-[#E8820C] text-white'
                        : 'bg-white border border-[#E5E7EB] text-[#6B7280]',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {relation === '직접입력' && (
                <input
                  type="text"
                  value={customRelation}
                  onChange={(e) => setCustomRelation(e.target.value)}
                  placeholder="관계를 입력해주세요"
                  className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 text-lg text-[#1F2937] outline-none focus:border-[#E8820C]"
                />
              )}
            </div>

            {/* 확인 버튼 */}
            <button
              type="button"
              onClick={handleAccept}
              disabled={loading || !code || !finalRelation}
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
