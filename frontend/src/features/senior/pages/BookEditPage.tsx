import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Check, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: '표지 선택' },
  { n: 2, label: '챕터 확인' },
  { n: 3, label: '에필로그' },
  { n: 4, label: '출간' },
]

const COVERS = [
  {
    id: 1,
    bg: '#FFF0DC',
    title: '봄 텃밭',
    titleColor: '#E8820C',
    sub1: '따뜻한 봄날의',
    sub2: '텃밭 이야기',
    decoration: 'garden',
  },
  {
    id: 2,
    bg: '#DCFCE7',
    title: '가족과 함께',
    titleColor: '#16A34A',
    sub1: '소중한 가족과',
    sub2: '함께한 시간들',
    decoration: 'family',
    badge: true,
  },
  {
    id: 3,
    bg: '#FEF9C3',
    title: '따뜻한 4월',
    titleColor: '#CA8A04',
    sub1: '햇살 가득했던',
    sub2: '4월의 기억',
    decoration: 'sun',
  },
]

const CHAPTERS = [
  {
    id: 1,
    title: '봄 텃밭과 토마토',
    preview1: '4월 초부터 시작한 텃밭 가꾸기. 드디어 빨간 토마토가...',
    preview2: '손녀에게도 나눠주며 행복한 시간을 보냈다.',
  },
  {
    id: 2,
    title: '손녀 수빈이의 중학교 입학',
    preview1: '드디어 수빈이가 중학생이 되었다. 교복을 입은 모습이...',
    preview2: '어찌나 예쁘고 대견하던지 눈물이 날 것 같았다.',
  },
  {
    id: 3,
    title: '봄비 오던 날의 추억',
    preview1: '오랜만에 봄비가 내렸다. 빗소리를 들으며 옛 생각이...',
    preview2: '젊은 시절 남편과 함께 걷던 골목이 떠올랐다.',
  },
]

function GardenDecoration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div
          key={i}
          className="absolute w-3 h-5 rounded-full"
          style={{ backgroundColor: '#E8820C', opacity: 0.35, transform: `rotate(${deg}deg) translateY(-14px)`, transformOrigin: 'center 14px' }}
        />
      ))}
      <div className="w-4 h-4 rounded-full bg-[#E8820C] opacity-60 z-10" />
    </div>
  )
}

function FamilyDecoration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center gap-2">
      <div className="w-8 h-8 rounded-full border-[1.5px] border-[#16A34A] opacity-50" />
      <div className="flex flex-col gap-1">
        <div className="w-5 h-5 rounded-full border-[1.5px] border-[#16A34A] opacity-40" />
        <div className="w-5 h-5 rounded-full border-[1.5px] border-[#16A34A] opacity-40" />
      </div>
    </div>
  )
}

function SunDecoration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="w-10 h-10 rounded border-2 border-[#CA8A04] opacity-50" />
      <div className="absolute w-10 h-[2px] bg-[#CA8A04] opacity-40" />
      <div className="absolute w-[2px] h-10 bg-[#CA8A04] opacity-40" />
      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#CA8A04] opacity-30" />
    </div>
  )
}

function CoverDecoration({ type }: { type: string }) {
  if (type === 'garden') return <GardenDecoration />
  if (type === 'family') return <FamilyDecoration />
  return <SunDecoration />
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-6 sm:px-8 pt-3 pb-4">
      <div className="relative h-[2px] bg-[#D1D5DB] rounded-full mb-4 mx-3">
        <div
          className="absolute top-0 left-0 h-full bg-[#E8820C] rounded-full transition-all"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STEPS.map((step) => {
          const done = step.n < currentStep
          const active = step.n === currentStep
          return (
            <div key={step.n} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center',
                  done ? 'bg-[#16A34A]' : active ? 'bg-[#E8820C]' : 'bg-[#D1D5DB]'
                )}
              >
                {done
                  ? <Check size={14} className="text-white" strokeWidth={3} />
                  : <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-[#6B7280]')}>{step.n}</span>
                }
              </div>
              <span className={cn('text-xs', done ? 'text-[#16A34A] font-bold' : active ? 'text-[#E8820C] font-bold' : 'text-[#6B7280]')}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function BookEditPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCover, setSelectedCover] = useState(2)
  const [removedChapters, setRemovedChapters] = useState<number[]>([])
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)

  function removeChapter(id: number) {
    setRemovedChapters((prev) => [...prev, id])
    setConfirmRemoveId(null)
  }

  const activeChapters = CHAPTERS.filter((c) => !removedChapters.includes(c.id))
  const confirmChapter = CHAPTERS.find((c) => c.id === confirmRemoveId)

  return (
    <div className="flex-1 flex flex-col bg-[#FFF8F0]">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button
          type="button"
          onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11"
        >
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          4월 책 만들기
        </h1>
      </header>

      <StepIndicator currentStep={currentStep} />

      {/* Step 1 — 표지 선택 */}
      {currentStep === 1 && (
        <>
          <main className="flex-1 overflow-y-auto pb-[100px] w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[1.5rem] font-bold text-[#1F2937]">이번 달 책 표지를 골라주세요</p>
              <p className="text-[1.125rem] text-[#6B7280]">AI가 이번 달 이야기를 바탕으로 만들었어요</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {COVERS.map((cover) => {
                const isSelected = selectedCover === cover.id
                return (
                  <button key={cover.id} type="button" onClick={() => setSelectedCover(cover.id)} className="flex flex-col items-stretch">
                    <div
                      className={cn('relative rounded-xl overflow-hidden flex flex-col', isSelected ? 'border-[3px] border-[#E8820C]' : 'border border-[#E5E7EB]')}
                      style={{ backgroundColor: cover.bg }}
                    >
                      {cover.badge && (
                        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#E8820C] border-2 border-white flex items-center justify-center z-10">
                          <span className="text-[8px] text-white font-bold leading-none">N</span>
                        </div>
                      )}
                      <div className="h-[80px] flex items-center justify-center p-3">
                        <CoverDecoration type={cover.decoration} />
                      </div>
                      <div className="px-2 pb-3 flex flex-col items-center gap-1">
                        <p className="text-sm font-bold text-center" style={{ color: cover.titleColor }}>{cover.title}</p>
                        <p className="text-[11px] text-[#6B7280] text-center leading-[14px]">{cover.sub1}</p>
                        <p className="text-[11px] text-[#6B7280] text-center leading-[14px]">{cover.sub2}</p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-2 bg-[#E8820C] rounded-xl py-2 text-center">
                        <span className="text-sm font-bold text-white">선택됨</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </main>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            <button type="button" onClick={() => setCurrentStep(2)} className="w-full bg-[#E8820C] rounded-2xl py-4 text-center">
              <span className="text-[1.25rem] text-white">이 표지로 할게요</span>
            </button>
          </div>
        </>
      )}

      {/* Step 2 — 챕터 확인 */}
      {currentStep === 2 && (
        <>
          <main className="flex-1 overflow-y-auto pb-[100px] w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[1.5rem] font-bold text-[#1F2937]">이번 달 이야기들이에요</p>
              <p className="text-[1.125rem] text-[#6B7280]">마음에 들지 않는 이야기는 빼도 돼요</p>
            </div>

            <div className="flex flex-col gap-3">
              {activeChapters.map((chapter, idx) => (
                <div key={chapter.id} className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <span className="text-[1.25rem] font-bold text-[#E8820C] shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <p className="text-[1.25rem] font-bold text-[#1F2937]">{chapter.title}</p>
                      <p className="text-[1.125rem] text-[#6B7280]">{chapter.preview1}</p>
                      <p className="text-[1.125rem] text-[#6B7280]">{chapter.preview2}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(chapter.id)}
                      className="bg-[#FEF2F2] rounded-xl px-4 py-2 min-h-11"
                    >
                      <span className="text-base text-[#DC2626]">이 이야기 빼기</span>
                    </button>
                  </div>
                </div>
              ))}

              {activeChapters.length === 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-8 text-center">
                  <p className="text-base text-[#9CA3AF]">모든 이야기가 빠졌어요. 뒤로 가서 다시 선택해주세요.</p>
                </div>
              )}
            </div>
          </main>

          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              disabled={activeChapters.length === 0}
              className="w-full bg-[#E8820C] disabled:opacity-40 rounded-2xl py-4 text-center"
            >
              <span className="text-[1.25rem] text-white">다음으로</span>
            </button>
          </div>

          {/* 삭제 확인 다이얼로그 */}
          {confirmRemoveId !== null && confirmChapter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setConfirmRemoveId(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
                <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">이 이야기를 뺄까요?</p>
                <div className="bg-[#FFF8F0] rounded-xl px-4 py-3 text-center">
                  <p className="text-[1.125rem] text-[#E8820C]">
                    {String(CHAPTERS.findIndex((c) => c.id === confirmRemoveId) + 1).padStart(2, '0')} {confirmChapter.title}
                  </p>
                </div>
                <p className="text-[1.125rem] text-[#6B7280] text-center">나중에 다시 넣을 수 있어요</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveId(null)}
                    className="flex-1 bg-[#FFF0DC] rounded-xl py-3 text-center min-h-11"
                  >
                    <span className="text-[1.125rem] text-[#E8820C]">취소</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChapter(confirmRemoveId)}
                    className="flex-1 bg-[#FEF2F2] rounded-xl py-3 text-center min-h-11"
                  >
                    <span className="text-[1.125rem] text-[#DC2626]">빼기</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 3 — 에필로그 */}
      {currentStep === 3 && (
        <Step3Epilogue onNext={() => setCurrentStep(4)} />
      )}

      {/* Step 4 — 출간 완료 */}
      {currentStep === 4 && (
        <Step4Published onHome={() => navigate('/s/books')} />
      )}

    </div>
  )
}

function Step3Epilogue({ onNext }: { onNext: () => void }) {
  const [text, setText] = useState('4월은 텃밭에서 토마토를 처음 수확한 달이라 참 기억에 남아요. 수빈이가 좋아하는 모습이 눈에 선해요...')
  const MAX = 200
  const aiPreview = '"4월은 텃밭에서 처음으로 토마토를 수확한 달이었다. 손녀 수빈이의 환한 얼굴이 오래도록 마음에 남는다."'

  return (
    <>
      <main className="flex-1 overflow-y-auto pb-[160px] w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[1.5rem] text-[#1F2937]">이번 달 마무리 한마디</p>
          <p className="text-[1.125rem] text-[#6B7280]">짧아도 괜찮아요. 말씀해 주시면 받아 적을게요</p>
        </div>

        {/* AI 말풍선 카드 */}
        <div className="bg-[#FFF0DC] rounded-2xl px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-medium">AI</span>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3">
            <p className="text-base text-[#1F2937]">"4월 한 달, 어떤 마음이셨나요? 떠오르는 대로 말씀해 주시면 에필로그로 담아드릴게요."</p>
          </div>
        </div>

        {/* 음성 입력 */}
        <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl px-5 py-5 flex flex-col items-center gap-3">
          <div className="absolute -top-3 left-4 bg-[#E8820C] rounded-lg px-2.5 py-0.5">
            <span className="text-sm text-white">추천</span>
          </div>
          <button type="button" className="w-14 h-14 rounded-full bg-[#E8820C] flex items-center justify-center">
            <Mic size={26} className="text-white" />
          </button>
          <div className="flex items-center gap-1 h-5">
            {[0.4, 0.6, 0.5, 0.7, 0.4, 0.0, 0.4, 0.7, 0.5, 0.6, 0.4].map((op, i) => (
              <div key={i} className="w-1 rounded-full bg-[#E8820C]" style={{ height: `${8 + op * 12}px`, opacity: op === 0 ? 0 : op }} />
            ))}
          </div>
          <p className="text-[1.125rem] text-[#E8820C]">듣고 있어요</p>
          <p className="text-[0.9375rem] text-[#6B7280]">마이크를 누르고 말씀해 주세요</p>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-base text-[#6B7280]">또는</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* 직접 입력 */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
          <p className="text-[1.125rem] text-[#1F2937]">직접 입력하기</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX))}
            rows={4}
            className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.0625rem] text-[#1F2937] resize-none outline-none focus:border-[#E8820C]"
            placeholder="이번 달 마무리 한마디를 입력해주세요"
          />
          <p className="text-right text-sm text-[#9CA3AF]">{text.length} / {MAX}</p>
        </div>

        {/* AI 에필로그 미리보기 */}
        <div className="bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-2">
          <p className="text-base text-[#6B7280]">AI가 다듬은 에필로그 미리보기</p>
          <p className="text-[1.0625rem] text-[#1F2937] leading-relaxed">{aiPreview}</p>
          <button type="button" className="self-end">
            <span className="text-[0.9375rem] text-[#E8820C]">AI에게 다시 써달라고 하기 ›</span>
          </button>
        </div>

      </main>

      {/* 하단 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4 flex flex-col gap-3">
        <p className="text-base text-[#6B7280] text-center">에필로그는 나중에 수정할 수 있어요</p>
        <div className="flex gap-3">
          <button type="button" onClick={onNext} className="flex-[2] bg-[#FFF0DC] rounded-2xl py-4 text-center">
            <span className="text-[1.125rem] text-[#E8820C]">건너뛰기</span>
          </button>
          <button type="button" onClick={onNext} className="flex-[5] bg-[#E8820C] rounded-2xl py-4 text-center">
            <span className="text-[1.25rem] text-white">이 에필로그로 할게요</span>
          </button>
        </div>
      </div>
    </>
  )
}

function Step4Published({ onHome }: { onHome: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

      {/* 책 표지 축하 영역 */}
      <div className="flex flex-col items-center gap-3 py-4 relative">
        {/* 반짝이 장식 */}
        <span className="absolute left-[10%] top-[10%] text-[1.5rem] text-[#E8820C]">✦</span>
        <span className="absolute right-[14%] top-[8%] text-[1.125rem] text-[#E8820C]">✦</span>
        <span className="absolute left-[7%] top-[48%] text-[0.875rem] text-[#E8820C]">✦</span>
        <span className="absolute right-[10%] top-[50%] text-[1.25rem] text-[#E8820C]">✦</span>
        <span className="absolute left-[14%] top-[68%] text-[1rem] text-[#E8820C]">✦</span>
        <span className="absolute right-[18%] top-[70%] text-[0.875rem] text-[#E8820C]">✦</span>

        {/* 책 표지 (레이어드) */}
        <div className="relative w-[140px] h-[170px]">
          {/* 뒤 레이어 */}
          <div className="absolute top-0 left-[-8px] w-full h-full bg-[#FFF0DC] rounded-xl opacity-50" />
          <div className="absolute top-[12px] left-[-4px] w-full h-full bg-[#FFF0DC] rounded-xl opacity-60" />
          {/* 앞 레이어 (실제 표지) */}
          <div className="absolute top-[24px] left-0 w-full h-[calc(100%-24px)] bg-[#FFF0DC] border-2 border-[#E8820C] rounded-xl flex flex-col items-center justify-center gap-1 px-3">
            {/* 왼쪽 accent */}
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E8820C] opacity-30 rounded-l-xl" />
            <p className="text-[1.25rem] text-[#E8820C] text-center font-medium">봄날의 기록</p>
            {/* 텍스트 줄 장식 */}
            <div className="w-full flex flex-col gap-1 mt-1 px-2">
              {[1, 0.8, 1, 0.7].map((w, i) => (
                <div key={i} className="h-[3px] bg-[#E8820C] opacity-20 rounded-full" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          </div>
          {/* 저자·날짜 (표지 아래) */}
          <div className="absolute bottom-[-44px] left-0 right-0 flex flex-col items-center gap-0.5">
            <p className="text-sm text-[#6B7280]">김영숙 지음</p>
            <p className="text-xs text-[#6B7280]">2025년 4월</p>
          </div>
        </div>

        <div className="mt-12" />
      </div>

      {/* 축하 텍스트 */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[1.75rem] text-[#1F2937]">책이 출간됐어요!</p>
        <p className="text-[1.125rem] text-[#6B7280]">가족 책장에 올라갔어요</p>
        <p className="text-[1.125rem] text-[#6B7280]">가족이 곧 읽을 거예요 :)</p>
      </div>

      {/* 가족 알림 카드 */}
      <div className="bg-[#DCFCE7] rounded-2xl px-5 py-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
          <Check size={18} className="text-white" strokeWidth={3} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[1.125rem] text-[#1F2937]">가족에게 알림을 보냈어요</p>
          <p className="text-[0.9375rem] text-[#6B7280]">김민준, 이수빈, 박지영 님께 새 책 알림이 갔어요</p>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex flex-col gap-3">
        <button type="button" className="w-full bg-[#E8820C] rounded-2xl py-4 text-center">
          <span className="text-[1.25rem] text-white">지금 바로 읽어보기</span>
        </button>
        <button type="button" className="w-full bg-[#FEE500] rounded-2xl py-4 flex items-center justify-center gap-3">
          <svg width="22" height="20" viewBox="0 0 40 36" fill="#3C1E1E" aria-hidden="true">
            <path d="M20 0C8.954 0 0 6.716 0 15c0 5.073 3.027 9.558 7.627 12.29L5.41 34.97a.75.75 0 0 0 1.082.8l9.196-5.832C16.54 30.3 18.25 30.5 20 30.5c11.046 0 20-6.716 20-15S31.046 0 20 0Z" />
          </svg>
          <span className="text-[1.25rem] text-[#3C1E1E]">카카오로 자랑하기</span>
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl flex divide-x divide-[#E5E7EB]">
        {[
          { label: '이번 달 대화', value: '18번' },
          { label: '챕터 수', value: '3개' },
          { label: '연결 가족', value: '3명' },
        ].map((stat) => (
          <div key={stat.label} className="flex-1 flex flex-col items-center py-4 gap-1">
            <p className="text-sm text-[#6B7280]">{stat.label}</p>
            <p className="text-[1.5rem] text-[#E8820C]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 홈으로 */}
      <button type="button" onClick={onHome} className="py-2 text-center">
        <span className="text-[1.125rem] text-[#6B7280]">홈으로 돌아가기</span>
      </button>

    </main>
  )
}
