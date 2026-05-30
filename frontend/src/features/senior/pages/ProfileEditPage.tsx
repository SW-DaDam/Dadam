import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import Toggle from '@/shared/components/Toggle'
import { cn, toHttps } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'

// 계정 탈퇴 더블체크 모달
function DeleteAccountModal({ onClose, onConfirm, deleting }: {
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  const [check1, setCheck1] = useState(false)
  const [check2, setCheck2] = useState(false)
  const canDelete = check1 && check2

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* 배경 딤 */}
      <div className="absolute inset-0 bg-[#1F2937] opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-5 z-10">
        <h2 className="text-[1.375rem] font-bold text-[#1F2937] text-center">정말 탈퇴할까요?</h2>
        <p className="text-base text-[#6B7280] text-center">아래 내용을 확인하고 모두 체크해야 탈퇴할 수 있어요</p>

        {/* 체크박스 목록 */}
        <div className="flex flex-col gap-3">
          {[
            { id: 'check1', checked: check1, set: setCheck1, label: '모든 대화 내역과 AI 기억이 삭제됩니다' },
            { id: 'check2', checked: check2, set: setCheck2, label: '책과 챕터가 영구 삭제되며 복구할 수 없어요' },
          ].map(({ id, checked, set, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => set((v) => !v)}
              className="flex items-center gap-3 bg-[#FEF2F2] rounded-xl px-4 py-3 text-left"
            >
              {/* 체크박스 아이콘 */}
              <div className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                checked ? 'bg-[#DC2626] border-[#DC2626]' : 'border-[#D1D5DB] bg-white',
              )}>
                {checked && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-base text-[#374151]">{label}</span>
            </button>
          ))}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-[#F3F4F6] rounded-xl py-3 text-center min-h-11"
          >
            <span className="text-[1.0625rem] text-[#6B7280]">취소</span>
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canDelete || deleting}
            className="flex-1 bg-[#DC2626] rounded-xl py-3 text-center min-h-11 disabled:opacity-40"
          >
            <span className="text-[1.0625rem] text-white">
              {deleting ? '탈퇴 중…' : '탈퇴하기'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

const PRESETS = ['엄마', '아빠', '할머니', '할아버지', '직접 입력']

export default function ProfileEditPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profile = useAuthStore((s) => s.profile)
  const setProfile = useAuthStore((s) => s.setProfile)
  const displayName: string = user?.user_metadata?.full_name ?? user?.email ?? '사용자'
  const avatarUrl: string | null = toHttps(user?.user_metadata?.avatar_url ?? null)

  // DB에서 저장된 호칭을 초기값으로 사용, 없으면 '엄마'
  const savedNickname = profile?.display_name ?? '엄마'
  const initialPreset = PRESETS.includes(savedNickname) ? savedNickname : '직접 입력'

  const [nickname, setNickname] = useState(savedNickname)
  const [selected, setSelected] = useState(initialPreset)
  const [customInput, setCustomInput] = useState(initialPreset === '직접 입력')
  const [commentNotif, setCommentNotif] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // 프로필이 스토어에 없으면 DB에서 직접 조회
  useEffect(() => {
    if (profile || !user) return
    void supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          const name = data.display_name
          setNickname(name)
          setSelected(PRESETS.includes(name) ? name : '직접 입력')
          setCustomInput(!PRESETS.slice(0, -1).includes(name))
        }
      })
  }, [user, profile, setProfile])

  function handlePreset(preset: string) {
    if (preset === '직접 입력') {
      setCustomInput(true)
      setSelected('직접 입력')
    } else {
      setCustomInput(false)
      setSelected(preset)
      setNickname(preset)
    }
  }

  // delete-account Edge Function 호출 → 모든 데이터 삭제 후 로그인 화면으로 이동
  async function handleDeleteAccount() {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
    })
    if (!error) {
      useAuthStore.getState().clear()
      navigate('/login')
    } else {
      setDeleting(false)
      setShowDeleteModal(false)
      alert('탈퇴에 실패했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  // 호칭을 profiles.display_name에 저장
  async function handleSave() {
    if (!user || saving || !nickname.trim()) return
    setSaving(true)
    setSaveResult('idle')
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: nickname.trim() })
      .eq('id', user.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      setProfile(data)
      navigate(-1)
    } else {
      setSaveResult('error')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-white border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button" onClick={() => navigate(-1)} className="flex items-center min-h-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl text-[#1F2937] font-medium whitespace-nowrap">프로필 편집</h1>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-[#E8820C] rounded-lg px-4 py-1.5 min-h-11 disabled:opacity-50"
        >
          <span className="text-[1.0625rem] text-white">
            {saving ? '저장 중…' : '저장'}
          </span>
        </button>
      </header>

      {/* 프로필 사진 */}
      <div className="bg-white border-b border-[#E5E7EB] flex flex-col items-center py-8 gap-3">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-[#FEE500] flex items-center justify-center overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : <span className="text-2xl text-[#3C1E1E]">{displayName.charAt(0)}</span>
            }
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#FEE500] border-[3px] border-white flex items-center justify-center">
            <span className="text-[10px] text-[#3C1E1E] font-bold">K</span>
          </div>
        </div>
        <p className="text-base text-[#6B7280]">카카오 프로필 사진이 자동으로 사용돼요</p>
      </div>

      <main className="flex-1 overflow-y-auto flex flex-col gap-6 px-4 sm:px-6 py-6 w-full max-w-2xl mx-auto">

        {/* 이름 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">이름</label>
          <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="flex-1 text-[1.25rem] text-[#9CA3AF]">{displayName}</span>
            <span className="bg-[#E5E7EB] rounded-lg px-3 py-1 text-sm text-[#6B7280] shrink-0">카카오에서 가져와요</span>
          </div>
          <p className="text-sm text-[#9CA3AF] px-1">이름은 카카오 앱에서 변경할 수 있어요</p>
        </div>

        {/* 호칭 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">호칭</label>

          {/* 호칭 입력 */}
          <div className="bg-white border-2 border-[#E8820C] rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#E8820C] shrink-0" />
            {customInput ? (
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="호칭 입력"
                className="flex-1 text-[1.375rem] text-[#1F2937] bg-transparent outline-none placeholder:text-[#D1D5DB]"
                autoFocus
              />
            ) : (
              <span className="flex-1 text-[1.375rem] text-[#1F2937]">{nickname}</span>
            )}
            <button
              type="button"
              onClick={() => { setNickname(''); setCustomInput(true); setSelected('직접 입력') }}
              className="w-8 h-8 rounded-lg bg-[#E5E7EB] flex items-center justify-center shrink-0"
            >
              <span className="text-base text-[#6B7280]">✕</span>
            </button>
          </div>

          {/* 미리보기 배너 */}
          <div className="bg-[#FFF0DC] rounded-xl py-3 text-center">
            <p className="text-[1.0625rem] text-[#E8820C]">
              가족 책장에 &ldquo;{nickname || '호칭'}의 책장&rdquo; 으로 표시돼요
            </p>
          </div>

          {/* 자주 쓰는 호칭 */}
          <p className="text-base text-[#6B7280] px-1 mt-1">자주 쓰는 호칭</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePreset(preset)}
                className={cn(
                  'rounded-xl px-4 py-2 text-[1.125rem] border transition-colors',
                  selected === preset
                    ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                    : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* 알림 필드 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">알림</label>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="flex-1 flex flex-col gap-0.5">
              <p className="text-[1.125rem] text-[#1F2937]">가족 댓글 알림</p>
              <p className="text-base text-[#6B7280]">가족이 댓글을 달면 알려줘요</p>
            </div>
            <Toggle on={commentNotif} onChange={setCommentNotif} />
          </div>
        </div>

        {/* 계정 탈퇴 */}
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl py-4 text-center">
          <button type="button" onClick={() => setShowDeleteModal(true)}>
            <span className="text-[1.125rem] text-[#DC2626]">계정 탈퇴</span>
          </button>
        </div>

      </main>

      {/* 하단 저장 바 */}
      <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 pt-2 pb-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full max-w-2xl mx-auto block bg-[#E8820C] rounded-xl py-3 text-center disabled:opacity-50"
        >
          <span className="text-[1.125rem] text-white">
            {saving ? '저장 중…' : saveResult === 'error' ? '저장 실패, 다시 시도해요' : '저장하기'}
          </span>
        </button>
      </div>

      {/* 계정 탈퇴 더블체크 모달 */}
      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteAccount}
          deleting={deleting}
        />
      )}

    </div>
  )
}
