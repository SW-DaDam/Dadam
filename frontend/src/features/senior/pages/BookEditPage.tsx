import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronLeft, Check, Mic, Pencil, X, RotateCcw, RefreshCw, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBookEdit } from '@/features/bookshelf/hooks/useBookEdit'
import type { Chapter, CoverImage } from '@/types/domain'

// ─── 상수 ────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: '표지 선택' },
  { n: 2, label: '챕터 확인' },
  { n: 3, label: '헌사' },
  { n: 4, label: '출간' },
]

const MOCK_CHAPTERS: Chapter[] = [
  { id: 'mock-1', book_id: '', content: '4월 초부터 시작한 텃밭 가꾸기. 드디어 빨간 토마토가 열렸다. 손녀에게도 나눠주며 행복한 시간을 보냈다.', title: '봄 텃밭과 토마토', sort_order: 1, is_deleted: false, theme: '일상', source_utterance_ids: null, created_at: '', updated_at: '' },
  { id: 'mock-2', book_id: '', content: '드디어 수빈이가 중학생이 되었다. 교복을 입은 모습이 어찌나 예쁘고 대견하던지 눈물이 날 것 같았다.', title: '손녀 수빈이의 중학교 입학', sort_order: 2, is_deleted: false, theme: '가족', source_utterance_ids: null, created_at: '', updated_at: '' },
  { id: 'mock-3', book_id: '', content: '오랜만에 봄비가 내렸다. 빗소리를 들으며 옛 생각이 났다. 젊은 시절 남편과 함께 걷던 골목이 떠올랐다.', title: '봄비 오던 날의 추억', sort_order: 3, is_deleted: false, theme: '추억', source_utterance_ids: null, created_at: '', updated_at: '' },
]

const MOCK_COVERS = [
  { id: 'mock-c1', bg: '#FFF0DC', accent: '#E8820C', label: '봄 텃밭', decoration: 'garden' },
  { id: 'mock-c2', bg: '#DCFCE7', accent: '#16A34A', label: '가족과 함께', decoration: 'family' },
  { id: 'mock-c3', bg: '#FEF9C3', accent: '#CA8A04', label: '따뜻한 봄날', decoration: 'sun' },
]

// ─── 장식 ─────────────────────────────────────────────────────────

function GardenDecoration() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <div key={i} className="absolute w-3 h-5 rounded-full bg-[#E8820C] opacity-35"
          style={{ transform: `rotate(${deg}deg) translateY(-14px)`, transformOrigin: 'center 14px' }} />
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
    </div>
  )
}
function CoverDecoration({ type }: { type: string }) {
  if (type === 'garden') return <GardenDecoration />
  if (type === 'family') return <FamilyDecoration />
  return <SunDecoration />
}

// ─── 진행 표시기 ─────────────────────────────────────────────────

function StepIndicator({ currentStep, onStepClick }: { currentStep: number; onStepClick: (n: number) => void }) {
  return (
    <div className="bg-white border-b border-[#E5E7EB] px-6 sm:px-8 pt-2 pb-2 shrink-0">
      <div className="relative h-[2px] bg-[#D1D5DB] rounded-full mb-2 mx-3">
        <div className="absolute top-0 left-0 h-full bg-[#E8820C] rounded-full transition-all"
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }} />
      </div>
      <div className="flex justify-between">
        {STEPS.map((step) => {
          const done = step.n < currentStep
          const active = step.n === currentStep
          // 이미 완료된 단계 또는 현재 단계만 클릭 이동 허용
          const clickable = step.n <= currentStep
          return (
            <button key={step.n} type="button"
              onClick={() => clickable && onStepClick(step.n)}
              className={cn('flex flex-col items-center gap-1', clickable ? 'cursor-pointer' : 'cursor-default')}>
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center',
                done ? 'bg-[#16A34A]' : active ? 'bg-[#E8820C]' : 'bg-[#D1D5DB]')}>
                {done
                  ? <Check size={14} className="text-white" strokeWidth={3} />
                  : <span className={cn('text-sm font-bold', active ? 'text-white' : 'text-[#6B7280]')}>{step.n}</span>}
              </div>
              <span className={cn('text-xs', done ? 'text-[#16A34A] font-bold' : active ? 'text-[#E8820C] font-bold' : 'text-[#6B7280]')}>
                {step.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────

export default function BookEditPage() {
  const navigate = useNavigate()
  const { bookId } = useParams<{ bookId: string }>()
  const { book, chapters: realChapters, coverImages, loading, regenerating, extraCoverCount, extraCoverLimit, softDeleteChapter, restoreChapter, updateChapterTitle, selectCover, publishBook, regenerateCover } = useBookEdit(bookId)

  const [currentStep, setCurrentStep] = useState(1)
  const [selectedCoverId, setSelectedCoverId] = useState<string>(MOCK_COVERS[1].id)

  // 최초 로드 시에만 첫 번째 표지로 초기화
  // 재생성 후 coverImages가 갱신될 때 사용자가 선택한 표지가 리셋되지 않도록
  // 현재 선택된 ID가 목록에 없을 때만 첫 번째로 교정
  useEffect(() => {
    if (coverImages.length > 0 && !coverImages.some(c => c.id === selectedCoverId)) {
      setSelectedCoverId(coverImages[0].id)
    }
  }, [coverImages, selectedCoverId])
  const [viewingChapter, setViewingChapter] = useState<Chapter | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [dedication, setDedication] = useState('')
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const chapters = realChapters.length > 0 ? realChapters : MOCK_CHAPTERS
  const isMock = realChapters.length === 0
  const activeChapters = chapters.filter(c => !c.is_deleted)
  const deletedChapters = chapters.filter(c => c.is_deleted)
  const confirmChapter = chapters.find(c => c.id === confirmRemoveId)

  const bookTitle = book
    ? `${book.year}년 ${book.month}월 책`
    : '이번 달 책 만들기'

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  // ─── 챕터 제목 편집 ─────────────────────────────────────────────

  function startEditTitle(chapter: Chapter) {
    setEditingChapterId(chapter.id)
    setEditingTitle(chapter.title)
  }

  async function confirmEditTitle() {
    if (!editingChapterId || !editingTitle.trim()) return
    if (isMock) { setEditingChapterId(null); return }
    try {
      await updateChapterTitle(editingChapterId, editingTitle.trim())
    } catch {
      showToast('제목 변경에 실패했어요')
    }
    setEditingChapterId(null)
  }

  // ─── 챕터 빼기 / 되돌리기 ───────────────────────────────────────

  async function handleRemoveChapter(id: string) {
    setConfirmRemoveId(null)
    if (isMock) {
      // 목업: 로컬 상태 변경 없음 (MOCK_CHAPTERS는 불변). 안내만.
      showToast('목업 데이터입니다. 실제 데이터 연동 후 적용돼요')
      return
    }
    try {
      await softDeleteChapter(id)
    } catch {
      showToast('챕터를 뺄 수 없었어요')
    }
  }

  async function handleRestoreChapter(id: string) {
    if (isMock) { showToast('목업 데이터입니다'); return }
    try {
      await restoreChapter(id)
    } catch {
      showToast('되돌리기에 실패했어요')
    }
  }

  // ─── 출간 ────────────────────────────────────────────────────────

  async function handlePublish() {
    setPublishConfirmOpen(false)
    setPublishing(true)
    try {
      // 실제 커버가 있고 선택된 경우에만 select_cover 호출
      if (!isMock && coverImages.length > 0) {
        await selectCover(selectedCoverId)
      }
      if (!isMock && bookId) {
        await publishBook(dedication)
      }
      setPublished(true)
      setCurrentStep(4)
    } catch {
      showToast('출간에 실패했어요. 다시 시도해 주세요')
    } finally {
      setPublishing(false)
    }
  }

  // ─── 렌더 ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8F0]">
        <p className="text-[1.125rem] text-[#6B7280]">불러오는 중…</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#FFF8F0]">

      {/* 헤더 */}
      <header className="w-full h-[80px] bg-[#FFF8F0] border-b border-[#E5E7EB] flex items-center px-4 sm:px-6 shrink-0 relative">
        <button type="button"
          onClick={() => currentStep > 1 ? setCurrentStep(s => s - 1 as 1) : navigate(-1)}
          className="flex flex-col items-center justify-center min-h-11 min-w-11">
          <ChevronLeft size={22} className="text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">뒤로</span>
        </button>
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg sm:text-xl font-bold text-[#1F2937] whitespace-nowrap">
          {bookTitle}
        </h1>
      </header>

      {currentStep < 4 && <StepIndicator currentStep={currentStep} onStepClick={n => setCurrentStep(n as 1 | 2 | 3 | 4)} />}

      {/* ── Step 1: 표지 선택 (F-13) ── */}
      {currentStep === 1 && (
        <>
          <main className="flex-1 overflow-hidden w-full max-w-2xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <p className="text-[1.25rem] font-bold text-[#1F2937] whitespace-nowrap">이번 달 책 표지를 골라주세요</p>
                <p className="text-[1.0625rem] text-[#6B7280]">AI가 이번 달 이야기를 바탕으로 만들었어요</p>
              </div>
              {/* 표지 추가 생성 버튼 — 최대 3장 추가 가능 */}
              {coverImages.length > 0 && (
                <button type="button"
                  disabled={regenerating || extraCoverCount >= extraCoverLimit}
                  className="shrink-0 flex flex-col items-center gap-1 mt-1 disabled:opacity-40"
                  onClick={async () => {
                    // 현재 선택된 표지의 chapter_id를 찾아 해당 챕터 표지 재생성
                    const chapterId = coverImages.find(c => c.id === selectedCoverId)?.chapter_id
                    if (!chapterId) return
                    try {
                      await regenerateCover(chapterId)
                    } catch (e) {
                      showToast(e instanceof Error ? e.message : '표지 생성에 실패했어요')
                    }
                  }}>
                  <div className="w-11 h-11 rounded-full bg-[#FFF0DC] border border-[#E8820C] flex items-center justify-center">
                    <RefreshCw size={20} className={cn('text-[#E8820C]', regenerating && 'animate-spin')} />
                  </div>
                  <span className="text-xs text-[#E8820C]">
                    {regenerating ? '생성 중…' : `다시 만들기 (${extraCoverCount}/${extraCoverLimit})`}
                  </span>
                </button>
              )}
            </div>

            {/* 표지 슬라이드 선택 */}
            {coverImages.length > 0 ? (
              <CoverSlider
                covers={coverImages}
                selectedId={selectedCoverId}
                onSelect={setSelectedCoverId}
              />
            ) : (
              <MockCoverSlider
                covers={MOCK_COVERS}
                selectedId={selectedCoverId}
                onSelect={setSelectedCoverId}
              />
            )}
          </main>

          <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            <button type="button" onClick={() => setCurrentStep(2)}
              className="w-full max-w-2xl mx-auto block bg-[#E8820C] rounded-2xl py-4 text-center">
              <span className="text-[1.25rem] text-white">이 표지로 할게요</span>
            </button>
          </div>
        </>
      )}

      {/* ── Step 2: 챕터 확인 (F-12) ── */}
      {currentStep === 2 && (
        <>
          <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-[1.5rem] font-bold text-[#1F2937]">이번 달 이야기들이에요</p>
              <p className="text-[1.125rem] text-[#6B7280]">마음에 들지 않는 이야기는 빼도 돼요</p>
            </div>

            {/* 활성 챕터 */}
            <div className="flex flex-col gap-3">
              {activeChapters.map((chapter, idx) => (
                <div key={chapter.id} className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-[1.25rem] font-bold text-[#E8820C] shrink-0">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      {/* 제목 (편집 모드 토글) */}
                      {editingChapterId === chapter.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value.slice(0, 100))}
                            className="flex-1 border-b-2 border-[#E8820C] bg-transparent text-[1.125rem] text-[#1F2937] outline-none py-0.5"
                            onKeyDown={e => { if (e.key === 'Enter') confirmEditTitle() }}
                          />
                          <button type="button" onClick={confirmEditTitle}
                            className="w-8 h-8 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
                            <Check size={14} className="text-white" strokeWidth={3} />
                          </button>
                          <button type="button" onClick={() => setEditingChapterId(null)}
                            className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                            <X size={14} className="text-[#6B7280]" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => startEditTitle(chapter)}
                          className="flex items-center gap-2 text-left group">
                          <p className="text-[1.125rem] font-bold text-[#1F2937] group-hover:text-[#E8820C] transition-colors">
                            {chapter.title}
                          </p>
                          <Pencil size={14} className="text-[#D1D5DB] group-hover:text-[#E8820C] shrink-0 transition-colors" />
                        </button>
                      )}
                      <p className="text-[1.0625rem] text-[#6B7280] line-clamp-2">{chapter.content}</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setViewingChapter(chapter)}
                      className="bg-[#F3F4F6] rounded-xl px-4 py-2 min-h-11 flex items-center gap-1.5">
                      <BookOpen size={15} className="text-[#6B7280]" />
                      <span className="text-base text-[#6B7280]">내용 보기</span>
                    </button>
                    <button type="button" onClick={() => setConfirmRemoveId(chapter.id)}
                      disabled={editingChapterId === chapter.id}
                      className="bg-[#FEF2F2] rounded-xl px-4 py-2 min-h-11 disabled:opacity-40">
                      <span className="text-base text-[#DC2626]">이 이야기 빼기</span>
                    </button>
                  </div>
                </div>
              ))}

              {activeChapters.length === 0 && (
                <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-8 text-center">
                  <p className="text-base text-[#9CA3AF]">모든 이야기가 빠졌어요. 아래에서 다시 넣을 수 있어요.</p>
                </div>
              )}
            </div>

            {/* 삭제된 챕터 (되돌리기) */}
            {deletedChapters.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-base text-[#9CA3AF] px-1">뺀 이야기 — 되돌릴 수 있어요</p>
                {deletedChapters.map(chapter => (
                  <div key={chapter.id}
                    className="bg-[#F3F4F6] border border-dashed border-[#D1D5DB] rounded-2xl px-5 py-3 flex items-center gap-3 opacity-60">
                    <p className="flex-1 text-[1.0625rem] text-[#6B7280] line-through truncate">{chapter.title}</p>
                    <button type="button" onClick={() => handleRestoreChapter(chapter.id)}
                      className="flex items-center gap-1.5 bg-white border border-[#D1D5DB] rounded-xl px-3 py-2 min-h-11 shrink-0">
                      <RotateCcw size={14} className="text-[#6B7280]" />
                      <span className="text-sm text-[#6B7280]">되돌리기</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </main>

          <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4">
            <button type="button" onClick={() => setCurrentStep(3)}
              disabled={activeChapters.length === 0}
              className="w-full max-w-2xl mx-auto block bg-[#E8820C] disabled:opacity-40 rounded-2xl py-4 text-center">
              <span className="text-[1.25rem] text-white">다음으로</span>
            </button>
          </div>

          {/* 챕터 내용 보기 모달 */}
          {viewingChapter && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setViewingChapter(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm flex flex-col gap-4 z-10 max-h-[75vh]">
                {/* 모달 헤더 */}
                <div className="flex items-center justify-between px-5 pt-5">
                  <p className="text-[1.125rem] font-bold text-[#E8820C] flex-1 pr-2">{viewingChapter.title}</p>
                  <button type="button" onClick={() => setViewingChapter(null)}
                    className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center shrink-0">
                    <X size={16} className="text-[#6B7280]" />
                  </button>
                </div>
                {/* 본문 스크롤 영역 */}
                <div className="overflow-y-auto px-5 pb-5">
                  <p className="text-[1.0625rem] text-[#1F2937] leading-relaxed whitespace-pre-wrap">
                    {viewingChapter.content}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 챕터 빼기 확인 모달 */}
          {confirmRemoveId !== null && confirmChapter && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setConfirmRemoveId(null)} />
              <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
                <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">이 이야기를 뺄까요?</p>
                <div className="bg-[#FFF8F0] rounded-xl px-4 py-3 text-center">
                  <p className="text-[1.125rem] text-[#E8820C]">{confirmChapter.title}</p>
                </div>
                <p className="text-[1.125rem] text-[#6B7280] text-center">나중에 다시 넣을 수 있어요</p>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setConfirmRemoveId(null)}
                    className="flex-1 bg-[#FFF0DC] rounded-xl py-3 text-center min-h-11">
                    <span className="text-[1.125rem] text-[#E8820C]">취소</span>
                  </button>
                  <button type="button" onClick={() => handleRemoveChapter(confirmRemoveId)}
                    className="flex-1 bg-[#FEF2F2] rounded-xl py-3 text-center min-h-11">
                    <span className="text-[1.125rem] text-[#DC2626]">빼기</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Step 3: 헌사 입력 (F-13) ── */}
      {currentStep === 3 && (
        <Step3Dedication
          dedication={dedication}
          onChangeDedication={setDedication}
          onNext={() => setPublishConfirmOpen(true)}
          onSkip={() => setPublishConfirmOpen(true)}
        />
      )}

      {/* ── Step 4: 출간 완료 (F-13) ── */}
      {currentStep === 4 && published && (
        <Step4Published
          bookTitle={book?.title ?? '봄날의 기록'}
          onHome={() => navigate('/s')}
          onRead={() => bookId ? navigate(`/s/books/${bookId}`) : navigate('/s/books')}
        />
      )}

      {/* ── 출간 확인 모달 ── */}
      {publishConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-[#1F2937] opacity-45" onClick={() => setPublishConfirmOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-sm p-6 flex flex-col gap-4 z-10">
            <p className="text-[1.375rem] font-bold text-[#1F2937] text-center">출간할까요?</p>
            <p className="text-[1.125rem] text-[#6B7280] text-center">출간 후에는 취소할 수 없어요.</p>
            <p className="text-[1.0625rem] text-[#6B7280] text-center">가족에게 알림이 전송돼요.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setPublishConfirmOpen(false)}
                className="flex-1 bg-[#F3F4F6] rounded-xl py-3 text-center min-h-11">
                <span className="text-[1.125rem] text-[#6B7280]">취소</span>
              </button>
              <button type="button" onClick={handlePublish} disabled={publishing}
                className="flex-1 bg-[#E8820C] rounded-xl py-3 text-center min-h-11 disabled:opacity-50">
                <span className="text-[1.125rem] text-white">{publishing ? '출간 중…' : '출간하기'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1F2937] rounded-xl px-5 py-3 shadow-lg">
          <p className="text-base text-white whitespace-nowrap">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}

// ─── 실제 표지 슬라이더 ──────────────────────────────────────────

function CoverSlider({ covers, selectedId, onSelect }: {
  covers: CoverImage[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const currentIdx = covers.findIndex(c => c.id === selectedId)
  const idx = currentIdx < 0 ? 0 : currentIdx

  function prev() { onSelect(covers[(idx - 1 + covers.length) % covers.length].id) }
  function next() { onSelect(covers[(idx + 1) % covers.length].id) }

  return (
    <div className="relative w-full">
      <div className="rounded-2xl overflow-hidden border-[3px] border-[#E8820C] aspect-[4/3] w-full">
        <img src={covers[idx].image_url} alt="선택된 표지" className="w-full h-full object-cover" />
      </div>

      {/* 점 인디케이터 — 이미지 상단에 오버레이 */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {covers.map((c, i) => (
          <div key={c.id} onClick={() => onSelect(c.id)}
            className={cn('rounded-full cursor-pointer transition-all',
              i === idx ? 'w-3 h-3 bg-[#E8820C]' : 'w-3 h-3 bg-white/70')} />
        ))}
      </div>

      {/* 이전 버튼 */}
      <button type="button" onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
        <ChevronLeft size={22} className="text-[#1F2937]" />
      </button>
      {/* 다음 버튼 */}
      <button type="button" onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
        <ChevronLeft size={22} className="text-[#1F2937] rotate-180" />
      </button>
    </div>
  )
}

// ─── 목업 표지 슬라이더 ──────────────────────────────────────────

function MockCoverSlider({ covers, selectedId, onSelect }: {
  covers: typeof MOCK_COVERS
  selectedId: string
  onSelect: (id: string) => void
}) {
  const currentIdx = covers.findIndex(c => c.id === selectedId)
  const idx = currentIdx < 0 ? 0 : currentIdx

  function prev() { onSelect(covers[(idx - 1 + covers.length) % covers.length].id) }
  function next() { onSelect(covers[(idx + 1) % covers.length].id) }

  const cover = covers[idx]
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full">
        <div className="rounded-2xl overflow-hidden border-[3px] border-[#E8820C] aspect-[4/3] w-full flex flex-col items-center justify-center"
          style={{ backgroundColor: cover.bg }}>
          <CoverDecoration type={cover.decoration} />
          <p className="mt-4 text-base font-bold" style={{ color: cover.accent }}>{cover.label}</p>
        </div>
        <button type="button" onClick={prev}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
          <ChevronLeft size={22} className="text-[#1F2937]" />
        </button>
        <button type="button" onClick={next}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shadow-md">
          <ChevronLeft size={22} className="text-[#1F2937] rotate-180" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        {covers.map((c, i) => (
          <button key={c.id} type="button" onClick={() => onSelect(c.id)}
            className={cn('rounded-full transition-all', i === idx ? 'w-3 h-3 bg-[#E8820C]' : 'w-2 h-2 bg-[#D1D5DB]')} />
        ))}
      </div>
    </div>
  )
}

// ─── Step 3: 헌사 입력 ───────────────────────────────────────────

function Step3Dedication({
  dedication, onChangeDedication, onNext, onSkip,
}: {
  dedication: string
  onChangeDedication: (v: string) => void
  onNext: () => void
  onSkip: () => void
}) {
  const MAX = 200
  return (
    <>
      <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[1.5rem] text-[#1F2937]">이번 달 마무리 한마디</p>
          <p className="text-[1.125rem] text-[#6B7280]">짧아도 괜찮아요. 가족에게 전하는 헌사예요</p>
        </div>

        <div className="bg-[#FFF0DC] rounded-2xl px-4 py-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-[#E8820C] flex items-center justify-center shrink-0">
            <span className="text-sm text-white font-medium">AI</span>
          </div>
          <div className="flex-1 bg-white rounded-xl px-4 py-3">
            <p className="text-base text-[#1F2937]">"4월 한 달, 어떤 마음이셨나요? 가족에게 남기고 싶은 한마디를 써주세요."</p>
          </div>
        </div>

        <div className="relative bg-white border-2 border-[#E8820C] rounded-2xl px-5 py-5 flex flex-col items-center gap-3">
          <div className="absolute -top-3 left-4 bg-[#E8820C] rounded-lg px-2.5 py-0.5">
            <span className="text-sm text-white">추천</span>
          </div>
          <button type="button" className="w-14 h-14 rounded-full bg-[#E8820C] flex items-center justify-center">
            <Mic size={26} className="text-white" />
          </button>
          <p className="text-[1.125rem] text-[#E8820C]">마이크를 누르고 말씀해 주세요</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-base text-[#6B7280]">또는</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl px-5 py-4 flex flex-col gap-3">
          <p className="text-[1.125rem] text-[#1F2937]">직접 입력하기</p>
          <textarea
            value={dedication}
            onChange={e => onChangeDedication(e.target.value.slice(0, MAX))}
            rows={4}
            placeholder="이번 달 마무리 한마디를 입력해주세요"
            className="w-full bg-[#FFF8F0] border border-[#E5E7EB] rounded-xl px-4 py-3 text-[1.0625rem] text-[#1F2937] resize-none outline-none focus:border-[#E8820C]"
          />
          <p className="text-right text-sm text-[#9CA3AF]">{dedication.length} / {MAX}</p>
        </div>
      </main>

      <div className="shrink-0 bg-white border-t border-[#E5E7EB] px-4 sm:px-6 py-4 flex flex-col gap-3">
        <div className="flex gap-3 w-full max-w-2xl mx-auto">
          <button type="button" onClick={onSkip} className="flex-[2] bg-[#FFF0DC] rounded-2xl py-4 text-center">
            <span className="text-[1.125rem] text-[#E8820C]">건너뛰기</span>
          </button>
          <button type="button" onClick={onNext} className="flex-[5] bg-[#E8820C] rounded-2xl py-4 text-center">
            <span className="text-[1.25rem] text-white">출간하기</span>
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Step 4: 출간 완료 ───────────────────────────────────────────

function Step4Published({ bookTitle, onHome, onRead }: { bookTitle: string; onHome: () => void; onRead: () => void }) {
  return (
    <main className="flex-1 overflow-y-auto w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 py-4 relative">
        {['left-[10%] top-[10%]', 'right-[14%] top-[8%]', 'left-[7%] top-[48%]', 'right-[10%] top-[50%]', 'left-[14%] top-[68%]', 'right-[18%] top-[70%]'].map((pos, i) => (
          <span key={i} className={`absolute ${pos} text-[${['1.5rem','1.125rem','0.875rem','1.25rem','1rem','0.875rem'][i]}] text-[#E8820C]`}>✦</span>
        ))}
        <div className="relative w-[140px] h-[170px]">
          <div className="absolute top-0 left-[-8px] w-full h-full bg-[#FFF0DC] rounded-xl opacity-50" />
          <div className="absolute top-[12px] left-[-4px] w-full h-full bg-[#FFF0DC] rounded-xl opacity-60" />
          <div className="absolute top-[24px] left-0 w-full h-[calc(100%-24px)] bg-[#FFF0DC] border-2 border-[#E8820C] rounded-xl flex flex-col items-center justify-center gap-1 px-3">
            <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-[#E8820C] opacity-30 rounded-l-xl" />
            <p className="text-[1.125rem] text-[#E8820C] text-center font-medium">{bookTitle}</p>
          </div>
        </div>
        <div className="mt-12" />
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[1.75rem] text-[#1F2937]">책이 출간됐어요!</p>
        <p className="text-[1.125rem] text-[#6B7280]">가족 책장에 올라갔어요</p>
        <p className="text-[1.125rem] text-[#6B7280]">가족이 곧 읽을 거예요 :)</p>
      </div>

      <div className="bg-[#DCFCE7] rounded-2xl px-5 py-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0">
          <Check size={18} className="text-white" strokeWidth={3} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[1.125rem] text-[#1F2937]">가족에게 알림을 보냈어요</p>
          <p className="text-[0.9375rem] text-[#6B7280]">연결된 가족 모두에게 새 책 알림이 갔어요</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" onClick={onRead} className="w-full bg-[#E8820C] rounded-2xl py-4 text-center">
          <span className="text-[1.25rem] text-white">지금 바로 읽어보기</span>
        </button>
        <button type="button" onClick={onHome} className="py-2 text-center">
          <span className="text-[1.125rem] text-[#6B7280]">홈으로 돌아가기</span>
        </button>
      </div>
    </main>
  )
}
