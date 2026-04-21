import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, Search, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Friend {
  id: string
  name: string
  relation: string
  phone: string
  avatarBg: string
  avatarText: string
  avatarTextColor: string
  invited: boolean
}

const FRIENDS: Friend[] = [
  { id: '1', name: '김민준', relation: '아들', phone: '010-1234-****', avatarBg: '#FEE500', avatarText: '민', avatarTextColor: '#3C1E1E', invited: false },
  { id: '2', name: '이수빈', relation: '손녀', phone: '010-5678-****', avatarBg: '#DCFCE7', avatarText: '빈', avatarTextColor: '#16A34A', invited: true },
  { id: '3', name: '박지영', relation: '딸', phone: '010-9012-****', avatarBg: '#FFF0DC', avatarText: '영', avatarTextColor: '#E8820C', invited: false },
  { id: '4', name: '김성호', relation: '사위', phone: '010-3456-****', avatarBg: '#F3F4F6', avatarText: '호', avatarTextColor: '#6B7280', invited: false },
]

const INVITE_CODE = 'A3K7F2'

export default function FamilyInvitePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [invited, setInvited] = useState<Set<string>>(
    new Set(FRIENDS.filter((f) => f.invited).map((f) => f.id)),
  )
  const [copied, setCopied] = useState(false)

  const filtered = FRIENDS.filter(
    (f) => f.name.includes(search) || f.relation.includes(search),
  )

  function handleInvite(id: string) {
    setInvited((prev) => new Set([...prev, id]))
  }

  function handleCopy() {
    navigator.clipboard.writeText(INVITE_CODE).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col">

      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">가족 초대하기</h1>
      </header>

      <main className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 sm:px-6 py-5 w-full max-w-2xl mx-auto">

        {/* 안내 배너 */}
        <div className="w-full bg-[#FFF0DC] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0 text-white text-sm font-bold">AI</div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">카카오톡으로 초대장을 보내요</p>
            <p className="text-base text-[#6B7280]">가족이 링크를 누르면 바로 연결돼요</p>
          </div>
        </div>

        {/* 카카오 빠른 초대 */}
        <button
          type="button"
          className="w-full bg-[#FEE500] rounded-2xl px-5 py-4 flex items-center gap-4"
        >
          <svg width="28" height="26" viewBox="0 0 40 36" fill="#3C1E1E" aria-hidden="true" className="shrink-0">
            <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
          </svg>
          <div className="flex-1 flex flex-col gap-0.5 text-left">
            <p className="text-xl text-[#3C1E1E]">카카오톡으로 초대장 보내기</p>
            <p className="text-base text-[#3C1E1E] opacity-70">버튼 한 번으로 초대 링크가 전달돼요</p>
          </div>
          <ChevronRight size={20} className="text-[#3C1E1E] opacity-40 shrink-0" />
        </button>

        {/* 연락처 검색 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">연락처에서 찾기</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-3 flex items-center gap-3">
            <Search size={18} className="text-[#9CA3AF] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름이나 연락처로 찾기"
              className="flex-1 text-[1.0625rem] text-[#1F2937] bg-transparent outline-none placeholder:text-[#D1D5DB]"
            />
          </div>
        </div>

        {/* 카카오 친구 목록 */}
        <div className="flex flex-col gap-2">
          <p className="text-base text-[#6B7280] px-1">카카오 친구</p>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {filtered.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-base font-medium"
                  style={{ backgroundColor: f.avatarBg, color: f.avatarTextColor }}
                >
                  {f.avatarText}
                </div>
                <div className="flex-1 flex flex-col gap-0.5">
                  <p className="text-[1.0625rem] text-[#1F2937]">{f.name}</p>
                  <p className="text-sm text-[#6B7280]">{f.relation} · {f.phone}</p>
                </div>
                {invited.has(f.id) ? (
                  <div className="flex items-center gap-1.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg px-3 py-1.5 shrink-0">
                    <div className="w-4 h-4 rounded-full bg-[#16A34A] flex items-center justify-center">
                      <span className="text-xs text-white">✓</span>
                    </div>
                    <span className="text-sm text-[#6B7280]">초대 완료</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInvite(f.id)}
                    className="bg-[#FEE500] rounded-lg px-3 py-1.5 shrink-0 min-h-11 flex items-center gap-1"
                  >
                    <svg width="14" height="13" viewBox="0 0 40 36" fill="#3C1E1E" aria-hidden="true">
                      <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
                    </svg>
                    <span className="text-sm text-[#3C1E1E]">초대하기</span>
                  </button>
                )}
              </div>
            ))}

            {/* 연락처 직접 입력 */}
            <div className="flex items-center gap-3 px-5 py-3">
              <div className="w-11 h-11 rounded-lg bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center shrink-0 text-2xl text-[#9CA3AF]">+</div>
              <div className="flex-1 flex flex-col gap-0.5">
                <p className="text-[1.0625rem] text-[#1F2937]">연락처 직접 입력</p>
                <p className="text-sm text-[#6B7280]">전화번호로 초대장 보내기</p>
              </div>
              <button type="button" className="bg-[#FFF0DC] border border-[#E8820C] rounded-lg px-3 py-1.5 shrink-0 min-h-11">
                <span className="text-base text-[#E8820C]">번호 입력</span>
              </button>
            </div>
          </div>
        </div>

        {/* 링크 복사 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0">
            <Copy size={18} className="text-[#6B7280]" />
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-[1.0625rem] text-[#1F2937]">초대 링크 복사하기</p>
            <p className="text-sm text-[#6B7280]">다른 앱으로 직접 보낼 수 있어요</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className={cn(
              'rounded-lg px-3 py-2 shrink-0 min-h-11 text-base transition-colors',
              copied ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F4F6] text-[#6B7280]',
            )}
          >
            {copied ? '복사됨' : '링크 복사'}
          </button>
        </div>

        {/* 초대 코드 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-base text-[#6B7280]">초대 코드</p>
            <div className="bg-[#F3F4F6] rounded-lg px-4 py-2">
              <span className="text-[1.0625rem] text-[#1F2937] tracking-widest font-mono">{INVITE_CODE}</span>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-0.5">
            <p className="text-sm text-[#6B7280]">코드를 알려주면 가족이 직접</p>
            <p className="text-sm text-[#6B7280]">입력해서 연결할 수 있어요</p>
          </div>
        </div>

      </main>
    </div>
  )
}
