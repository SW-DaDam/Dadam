import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/shared/stores/authStore'
import { supabase } from '@/lib/supabase'

// 성별 enum — DB senior_profiles.gender 컬럼과 동일 ('male' | 'female' | null)
type Gender = 'male' | 'female' | null

// 출생연도 유효 범위 — 회원가입 ProfileSetupPage와 동일 기준 유지
const CURRENT_YEAR = new Date().getFullYear()
const MIN_BIRTH_YEAR = 1900
const MAX_BIRTH_YEAR = CURRENT_YEAR

// birth_date 문자열(YYYY-MM-DD)에서 연도 4자리만 추출 — invalid 시 빈 문자열
function extractYear(birthDate: string | null | undefined): string {
  if (!birthDate) return ''
  const year = birthDate.slice(0, 4)
  return /^\d{4}$/.test(year) ? year : ''
}

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
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null

  // DB에서 저장된 호칭을 초기값으로 사용, 없으면 '엄마'
  const savedNickname = profile?.display_name ?? '엄마'
  const initialPreset = PRESETS.includes(savedNickname) ? savedNickname : '직접 입력'

  const [nickname, setNickname] = useState(savedNickname)
  const [selected, setSelected] = useState(initialPreset)
  const [customInput, setCustomInput] = useState(initialPreset === '직접 입력')
  // 성별/출생연도 — senior_profiles에서 마운트 후 DB 조회로 채움
  const [gender, setGender] = useState<Gender>(null)
  const [birthYear, setBirthYear] = useState('')
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

  // senior_profiles에서 gender, birth_date 조회 — profile과 독립 테이블이라 별도 fetch 필요
  // 의존성: user.id (string) — user 객체 자체보다 ID 문자열이 안정적
  const userId = user?.id
  useEffect(() => {
    if (!userId) return
    void supabase
      .from('senior_profiles')
      .select('gender, birth_date')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        // 에러 발생 시 silent하게 무시되던 경로 → 콘솔에 출력하여 디버깅 가능하도록
        if (error) {
          console.error('[ProfileEditPage] senior_profiles 로드 실패', error)
          return
        }
        if (!data) return
        // DB에는 'male'|'female' 외 값이 들어올 수 없도록 enum 제약이 있지만,
        // 방어적으로 타입 좁히기 — 알 수 없는 값은 null로 처리
        const g = data.gender
        setGender(g === 'male' || g === 'female' ? g : null)
        setBirthYear(extractYear(data.birth_date))
      })
  }, [userId])

  function handleBirthYearChange(val: string) {
    // 숫자만 허용 + 4자리 제한 — ProfileSetupPage와 동일 패턴
    if (val.length <= 4) setBirthYear(val)
  }

  // 4자리 입력 시에만 범위 검증 — 입력 중인 1~3자리는 invalid 표시 안 함
  const isBirthYearInvalid =
    birthYear.length === 4 &&
    (Number(birthYear) <= MIN_BIRTH_YEAR || Number(birthYear) >= MAX_BIRTH_YEAR)

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

  // 호칭(profiles.display_name) + 성별/출생연도(senior_profiles.gender, birth_date) 저장
  // 단일 RPC update_senior_basic_info로 처리 — plpgsql 함수 본문은 한 트랜잭션이므로
  // 두 테이블 UPDATE가 원자적으로 적용·롤백됨 (이전: 두 번 호출 → 둘째 실패 시 부분 커밋 발생)
  async function handleSave() {
    if (!user || saving || !nickname.trim() || isBirthYearInvalid) return
    setSaving(true)
    setSaveResult('idle')

    // 출생연도 정규화 — 4자리 유효값이면 'YYYY-01-01', 아니면 null (회원가입과 동일 규칙)
    const year = Number(birthYear)
    const isValidYear = birthYear.length === 4 && year > MIN_BIRTH_YEAR && year < MAX_BIRTH_YEAR
    const birthDate = isValidYear ? `${birthYear}-01-01` : null

    // RPC 호출 — 실패 시 두 테이블 모두 롤백
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 자동 생성 타입에 RPC 시그니처 미반영
    const { error: rpcError } = await (supabase as any).rpc('update_senior_basic_info', {
      p_display_name: nickname.trim(),
      p_gender: gender,
      p_birth_date: birthDate,
    })

    setSaving(false)

    if (rpcError) {
      console.error('[ProfileEditPage] update_senior_basic_info 실패', rpcError)
      setSaveResult('error')
      return
    }

    // 로컬 store 갱신 — DB 반영 확인 후에만, 기존 profile에 display_name만 머지
    if (profile) {
      setProfile({ ...profile, display_name: nickname.trim() })
    }
    navigate(-1)
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
          disabled={saving || isBirthYearInvalid}
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

      <main className="flex-1 overflow-y-auto flex flex-col gap-6 px-4 sm:px-6 py-6 w-full max-w-2xl md:max-w-none mx-auto">

        {/* 기본 정보 — 이름(카카오 자동) + 성별 + 출생연도를 하나의 박스로 묶음 */}
        <div className="flex flex-col gap-2">
          <label className="text-base text-[#6B7280] px-1">기본 정보</label>
          <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-4">

            {/* 이름 (카카오 자동 동기화 — 읽기 전용) */}
            <div className="flex flex-col gap-2">
              <p className="text-base text-[#6B7280]">이름</p>
              <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="flex-1 text-[1.25rem] text-[#9CA3AF]">{displayName}</span>
                <span className="bg-[#E5E7EB] rounded-lg px-3 py-1 text-sm text-[#6B7280] shrink-0">카카오에서 가져와요</span>
              </div>
              <p className="text-sm text-[#9CA3AF]">이름은 카카오 앱에서 변경할 수 있어요</p>
            </div>

            {/* 구분선 — 카드 내부 그룹 시각적 분리 */}
            <div className="border-t border-[#F3F4F6]" />

            {/* 성별 */}
            <div className="flex flex-col gap-2">
              <p className="text-base text-[#6B7280]">성별</p>
              <div className="flex gap-2">
                {(['female', 'male'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(gender === g ? null : g)}
                    className={cn(
                      'flex-1 min-h-11 px-4 rounded-xl text-[1.0625rem] border transition-colors',
                      gender === g
                        ? 'bg-[#FFF0DC] border-[#E8820C] text-[#E8820C]'
                        : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]',
                    )}
                  >
                    {g === 'female' ? '여성' : '남성'}
                  </button>
                ))}
              </div>
            </div>

            {/* 출생연도 */}
            <div className="flex flex-col gap-2">
              <p className="text-base text-[#6B7280]">출생연도</p>
              {isBirthYearInvalid && (
                <p className="text-sm text-red-500">
                  {MIN_BIRTH_YEAR + 1}년 ~ {MAX_BIRTH_YEAR - 1}년 사이로 입력해 주세요
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={birthYear}
                  onChange={(e) => handleBirthYearChange(e.target.value)}
                  placeholder="예: 1955"
                  min={MIN_BIRTH_YEAR + 1}
                  max={MAX_BIRTH_YEAR - 1}
                  className={cn(
                    'w-32 min-h-11 bg-[#F3F4F6] border rounded-lg px-3 text-[1.0625rem] text-[#1F2937] outline-none focus:border-[#E8820C]',
                    isBirthYearInvalid ? 'border-red-400' : 'border-[#E5E7EB]',
                  )}
                />
                <span className="text-[1.0625rem] text-[#6B7280]">년</span>
              </div>
            </div>

          </div>
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
          disabled={saving || isBirthYearInvalid}
          className="w-full max-w-2xl md:max-w-none mx-auto block bg-[#E8820C] rounded-xl py-3 text-center disabled:opacity-50"
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
